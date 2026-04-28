#!/usr/bin/env bash
set -u

ROOT=$(cd "$(dirname "$0")" && pwd)
SETUP_DONE="$ROOT/.toolbox/setup.done"

has() {
  command -v "$1" >/dev/null 2>&1
}

pause() {
  printf "\nPress Enter to continue..."
  read -r _ || true
}

json_value() {
  file=$1
  key=$2
  sed -nE 's/.*"'"$key"'"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' "$file" | head -1
}

# Tags line assumed like: "tags": ["a", "b"],
extract_tags_lines_from_manifest() {
  file=$1
  grep '"tags"' "$file" 2>/dev/null | head -1
}

tags_from_manifest_to_lines() {
  file=$1
  line=$(extract_tags_lines_from_manifest "$file")
  [ -z "$line" ] && return 0
  inner=${line#*[}
  inner=${inner%%]*}
  inner=${inner// /}
  oifs=$IFS
  IFS=','
  for t in $inner; do
    t=${t//\"/}
    t=${t//,/}
    [ -n "$t" ] && printf '%s\n' "$t"
  done
  IFS=$oifs
}

collect_all_tags_sorted() {
  tmp=$(mktemp)
  while IFS= read -r manifest; do
    tags_from_manifest_to_lines "$manifest"
  done < <(find "$ROOT/tools" -mindepth 3 -maxdepth 3 -name manifest.json 2>/dev/null | sort) >>"$tmp"
  if [ -s "$tmp" ]; then
    sort -u "$tmp"
  fi
  rm -f "$tmp"
}

escape_json_string() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\r//g' -e 's/\n/\\n/g'
}

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9_-]\+/ /g' -e 's/^ *//' -e 's/ *$//' -e 's/ /-/g' -e 's/-\+/-/g' -e 's/^-//' -e 's/-$//'
}

list_tools() {
  count=0
  while IFS= read -r manifest; do
    count=$((count + 1))
    dir=$(dirname "$manifest")
    intent=$(basename "$(dirname "$dir")")
    slug=$(basename "$dir")
    name=$(json_value "$manifest" "name")
    desc=$(json_value "$manifest" "description")
    printf "%-10s %-22s %s\n" "$intent" "$slug" "${name:-$desc}"
  done < <(find "$ROOT/tools" -mindepth 3 -maxdepth 3 -name manifest.json 2>/dev/null | sort)

  if [ "$count" -eq 0 ]; then
    echo "No tools found."
  fi
}

collect_tool_manifests() {
  find "$ROOT/tools" -mindepth 3 -maxdepth 3 -name manifest.json 2>/dev/null | sort
}

tool_display_line() {
  manifest=$1
  dir=$(dirname "$manifest")
  intent=$(basename "$(dirname "$dir")")
  slug=$(basename "$dir")
  name=$(json_value "$manifest" "name")
  printf '%s' "$intent/$slug — ${name:-$slug}"
}

run_selected_tool() {
  manifest=$1
  dir=$(dirname "$manifest")
  intent=$(basename "$(dirname "$dir")")
  slug=$(basename "$dir")
  runtime=$(json_value "$manifest" "runtime")
  entry=$(json_value "$manifest" "entry")
  tp="$ROOT/tools/$intent/$slug"

  case "$runtime" in
    bash)
      if [ -z "$entry" ]; then
        echo "Manifest missing entry for bash tool."
        return 1
      fi
      bash "$tp/$entry" "$@"
      ;;
    node)
      if [ -z "$entry" ]; then
        echo "Manifest missing entry for node tool."
        return 1
      fi
      if ! has node; then
        echo "node is not installed."
        return 1
      fi
      node "$tp/$entry" "$@"
      ;;
    readme)
      echo "This tool is readme-only."
      echo "Open: $tp/README.md"
      if has open; then
        open "$tp/README.md" 2>/dev/null || true
      fi
      ;;
    *)
      echo "Unknown runtime: $runtime"
      return 1
      ;;
  esac
}

prompt_line() {
  label=$1
  default=$2
  if has gum; then
    out=$(gum input --prompt "$label " --placeholder "${default:-}")
    if [ -z "$out" ] && [ -n "$default" ]; then
      out=$default
    fi
    printf '%s' "$out"
  else
    printf '%s' "$label"
    [ -n "$default" ] && printf ' [%s]' "$default"
    printf ': '
    read -r val
    if [ -z "$val" ] && [ -n "$default" ]; then
      val=$default
    fi
    printf '%s' "$val"
  fi
}

prompt_choice() {
  label=$1
  shift
  if has gum; then
    gum choose --header "$label" "$@"
  else
    echo "$label"
    i=1
    for opt in "$@"; do
      echo "  $i) $opt"
      i=$((i + 1))
    done
    printf 'Choose (number): '
    read -r n
    i=1
    for opt in "$@"; do
      if [ "$i" = "$n" ]; then
        echo "$opt"
        return 0
      fi
      i=$((i + 1))
    done
    echo ""
    return 1
  fi
}

prompt_confirm() {
  msg=$1
  if has gum; then
    gum confirm "$msg" && return 0
    return 1
  else
    printf '%s [y/N]: ' "$msg"
    read -r a
    case "$a" in
      y|Y) return 0 ;;
      *) return 1 ;;
    esac
  fi
}

action_run_tool() {
  manifests=()
  while IFS= read -r m; do
    manifests+=("$m")
  done < <(collect_tool_manifests)

  if [ "${#manifests[@]}" -eq 0 ]; then
    echo "No tools found."
    return 0
  fi

  lines=()
  for m in "${manifests[@]}"; do
    lines+=("$(tool_display_line "$m")")
  done

  if has gum; then
    choice=$(printf '%s\n' "${lines[@]}" | gum choose --header "Run tool") || return 0
  else
    echo "Run tool"
    echo "--------"
    idx=1
    for line in "${lines[@]}"; do
      echo "  $idx) $line"
      idx=$((idx + 1))
    done
    printf 'Choose (number): '
    read -r n
    choice=${lines[$((n - 1))]}
    if [ -z "$choice" ]; then
      echo "Invalid choice."
      return 1
    fi
  fi

  sel=""
  for m in "${manifests[@]}"; do
    if [ "$(tool_display_line "$m")" = "$choice" ]; then
      sel=$m
      break
    fi
  done
  if [ -z "$sel" ]; then
    echo "Could not resolve tool."
    return 1
  fi

  echo ""
  run_selected_tool "$sel"
}

parse_tags_input() {
  # stdin: comma or space separated
  tr ',' ' ' | tr -s '[:space:]' '\n' | sed '/^$/d'
}

action_create_tool() {
  echo "Create tool"
  echo "-----------"

  name=$(prompt_line "Tool name" "")
  name=${name//$'\r'/}
  [ -z "$name" ] && echo "Name required." && return 1

  slug=$(slugify "$name")
  [ -z "$slug" ] && echo "Could not derive slug from name." && return 1

  intent=$(prompt_choice "Intent" "macos" "files" "dev" "web" "notes" "custom") || return 1
  [ -z "$intent" ] && return 1

  desc=$(prompt_line "Short description" "")
  desc=${desc//$'\r'/}

  runtime=$(prompt_choice "Runtime" "bash" "node" "readme") || return 1
  [ -z "$runtime" ] && return 1

  echo ""
  echo "Existing tags (from other tools):"
  taglist=$(collect_all_tags_sorted)
  if [ -n "$taglist" ]; then
    echo "$taglist" | tr '\n' ' '
    echo ""
  else
    echo "(none yet)"
  fi
  printf '%s' "Tags (comma-separated, optional extra): "
  if has gum; then
    tags_raw=$(gum input --placeholder "e.g. macos, utils")
  else
    read -r tags_raw
  fi
  tags_raw=${tags_raw//$'\r'/}

  status=$(prompt_choice "Status" "experimental" "stable" "sample") || return 1
  [ -z "$status" ] && return 1

  ai_tag=false
  if prompt_confirm "Mark as AI-generated (add ai-generated tag)?"; then
    ai_tag=true
  fi

  target="$ROOT/tools/$intent/$slug"
  if [ -e "$target" ]; then
    echo "Already exists: $target"
    return 1
  fi

  mkdir -p "$target"

  # Build tags JSON array
  tags_file=$(mktemp)
  : >"$tags_file"
  first=true
  while IFS= read -r t; do
    [ -z "$t" ] && continue
    if $first; then
      first=false
    else
      printf ',' >>"$tags_file"
    fi
    printf '"%s"' "$(escape_json_string "$t")" >>"$tags_file"
  done < <(printf '%s\n' "$tags_raw" | parse_tags_input)

  if $ai_tag; then
    if [ -s "$tags_file" ]; then
      printf ',' >>"$tags_file"
    fi
    printf '"ai-generated"' >>"$tags_file"
  fi

  tags_inner=$(cat "$tags_file")
  rm -f "$tags_file"

  entry_basename=""
  entry_file=""
  if [ "$runtime" = "bash" ]; then
    entry_basename="${slug}.sh"
    entry_file="$target/$entry_basename"
  elif [ "$runtime" = "node" ]; then
    entry_basename="${slug}.mjs"
    entry_file="$target/$entry_basename"
  fi

  name_j=$(escape_json_string "$name")
  slug_j=$(escape_json_string "$slug")
  intent_j=$(escape_json_string "$intent")
  desc_j=$(escape_json_string "$desc")
  runtime_j=$(escape_json_string "$runtime")
  status_j=$(escape_json_string "$status")

  if [ "$runtime" = "readme" ]; then
    {
      printf '{\n'
      printf '  "name": "%s",\n' "$name_j"
      printf '  "slug": "%s",\n' "$slug_j"
      printf '  "intent": "%s",\n' "$intent_j"
      printf '  "description": "%s",\n' "$desc_j"
      printf '  "runtime": "%s",\n' "$runtime_j"
      printf '  "tags": [%s],\n' "$tags_inner"
      printf '  "status": "%s"\n' "$status_j"
      printf '}\n'
    } >"$target/manifest.json"
  else
    entry_j=$(escape_json_string "$entry_basename")
    {
      printf '{\n'
      printf '  "name": "%s",\n' "$name_j"
      printf '  "slug": "%s",\n' "$slug_j"
      printf '  "intent": "%s",\n' "$intent_j"
      printf '  "description": "%s",\n' "$desc_j"
      printf '  "entry": "%s",\n' "$entry_j"
      printf '  "runtime": "%s",\n' "$runtime_j"
      printf '  "tags": [%s],\n' "$tags_inner"
      printf '  "status": "%s"\n' "$status_j"
      printf '}\n'
    } >"$target/manifest.json"
  fi

  {
    printf '# %s\n\n' "$name"
    printf '%s\n\n' "$desc"
    printf '## Run\n\n'
    if [ "$runtime" = "bash" ]; then
      printf '`./start.sh` → Run tool, or:\n\n'
      printf '```bash\nbash tools/%s/%s/%s\n```\n' "$intent" "$slug" "$entry_basename"
    elif [ "$runtime" = "node" ]; then
      printf 'Requires Node.js.\n\n'
      printf '```bash\nnode tools/%s/%s/%s\n```\n' "$intent" "$slug" "$entry_basename"
    else
      printf 'Readme-only tool. See this file.\n'
    fi
  } >"$target/README.md"

  if [ -n "$entry_file" ]; then
    if [ "$runtime" = "bash" ]; then
      {
        printf '#!/usr/bin/env bash\n'
        printf 'set -u\n\n'
        printf '# %s\n' "$name"
      } >"$entry_file"
      chmod +x "$entry_file"
    else
      {
        printf '#!/usr/bin/env node\n'
        printf '/**\n * %s\n */\n\n' "$name"
        printf 'console.log("%s — stub. Edit %s.");\n' "$name" "$entry_basename"
      } >"$entry_file"
      chmod +x "$entry_file"
    fi
  fi

  echo ""
  echo "Created $target"
}

run_menu_numbered() {
  while true; do
    clear 2>/dev/null || true

    echo "toolbox"
    echo "======="
    echo
    echo "1. List tools"
    echo "2. Run tool"
    echo "3. Create tool"
    echo "4. Exit"
    echo
    printf "Choose: "
    read -r choice

    case "$choice" in
      1)
        echo
        list_tools
        pause
        ;;
      2)
        echo
        action_run_tool
        pause
        ;;
      3)
        echo
        action_create_tool
        pause
        ;;
      4)
        exit 0
        ;;
      *)
        echo "Unknown choice."
        pause
        ;;
    esac
  done
}

run_menu_gum() {
  while true; do
    clear 2>/dev/null || true

    choice=$(gum choose --header "toolbox" "List tools" "Run tool" "Create tool" "Exit") || exit 0

    case "$choice" in
      "List tools")
        echo
        list_tools
        pause
        ;;
      "Run tool")
        echo
        action_run_tool
        pause
        ;;
      "Create tool")
        echo
        action_create_tool
        pause
        ;;
      "Exit")
        exit 0
        ;;
    esac
  done
}

if [ ! -f "$SETUP_DONE" ]; then
  echo "Setup has not been run."
  printf "Run setup now? [Y/n]: "
  read -r answer

  case "$answer" in
    n|N) ;;
    *) "$ROOT/setup.sh" || exit $? ;;
  esac
fi

if has gum; then
  run_menu_gum
else
  run_menu_numbered
fi
