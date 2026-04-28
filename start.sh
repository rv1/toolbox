#!/usr/bin/env bash
set -u

ROOT=$(cd "$(dirname "$0")" && pwd)
SETUP_DONE="$ROOT/.toolbox/setup.done"
INTENTS="macos files dev web notes custom"
RUNTIMES="bash node readme"
STATUSES="experimental stable sample"

TOOL_MANIFESTS=()
TOOL_LABELS=()
SELECTED_MANIFEST=""

has() {
  command -v "$1" >/dev/null 2>&1
}

use_gum() {
  has gum && [ -t 0 ] && [ -t 1 ]
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

slugify() {
  printf "%s" "$1" |
    tr '[:upper:]' '[:lower:]' |
    sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

json_escape() {
  printf "%s" "$1" |
    sed 's/\\/\\\\/g; s/"/\\"/g'
}

normalize_tags() {
  raw=$1
  include_ai=$2
  include_sample=$3
  tags=""

  old_ifs=$IFS
  IFS=','
  for tag in $raw; do
    clean=$(printf "%s" "$tag" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
    if [ -n "$clean" ] && ! printf "%s\n" "$tags" | grep -qx "$clean"; then
      tags="${tags}${tags:+
}$clean"
    fi
  done
  IFS=$old_ifs

  if [ "$include_ai" = "yes" ] && ! printf "%s\n" "$tags" | grep -qx "ai-generated"; then
    tags="${tags}${tags:+
}ai-generated"
  fi

  if [ "$include_sample" = "yes" ] && ! printf "%s\n" "$tags" | grep -qx "sample"; then
    tags="${tags}${tags:+
}sample"
  fi

  printf "%s" "$tags"
}

tags_json() {
  tags=$1
  output="["
  first=1

  while IFS= read -r tag; do
    [ -n "$tag" ] || continue
    if [ "$first" -eq 0 ]; then
      output="$output, "
    fi
    output="$output\"$(json_escape "$tag")\""
    first=0
  done <<EOF
$tags
EOF

  output="$output]"
  printf "%s" "$output"
}

choose_from_list_numbered() {
  prompt=$1
  shift
  options="$*"
  count=0

  echo "$prompt"
  for option in $options; do
    count=$((count + 1))
    printf "%d. %s\n" "$count" "$option"
  done
  printf "Choose: "
  read -r choice

  case "$choice" in
    ''|*[!0-9]*) return 1 ;;
  esac

  count=0
  for option in $options; do
    count=$((count + 1))
    if [ "$choice" -eq "$count" ]; then
      printf "%s" "$option"
      return 0
    fi
  done

  return 1
}

choose_option() {
  prompt=$1
  shift

  if use_gum; then
    gum choose --header "$prompt" "$@"
  else
    choose_from_list_numbered "$prompt" "$@"
  fi
}

load_tools() {
  TOOL_MANIFESTS=()
  TOOL_LABELS=()

  while IFS= read -r manifest; do
    [ -n "$manifest" ] || continue
    dir=$(dirname "$manifest")
    intent=$(basename "$(dirname "$dir")")
    slug=$(basename "$dir")
    name=$(json_value "$manifest" "name")
    desc=$(json_value "$manifest" "description")
    TOOL_MANIFESTS[${#TOOL_MANIFESTS[@]}]="$manifest"
    TOOL_LABELS[${#TOOL_LABELS[@]}]="$intent/$slug - ${name:-$desc}"
  done <<EOF
$(find "$ROOT/tools" -mindepth 3 -maxdepth 3 -name manifest.json 2>/dev/null | sort)
EOF
}

list_tools() {
  load_tools

  if [ "${#TOOL_MANIFESTS[@]}" -eq 0 ]; then
    echo "No tools found."
    return
  fi

  printf "%-10s %-22s %-12s %s\n" "Intent" "Slug" "Runtime" "Name"
  printf "%-10s %-22s %-12s %s\n" "------" "----" "-------" "----"

  i=0
  while [ "$i" -lt "${#TOOL_MANIFESTS[@]}" ]; do
    manifest=${TOOL_MANIFESTS[$i]}
    dir=$(dirname "$manifest")
    intent=$(basename "$(dirname "$dir")")
    slug=$(basename "$dir")
    name=$(json_value "$manifest" "name")
    runtime=$(json_value "$manifest" "runtime")

    printf "%-10s %-22s %-12s %s\n" "$intent" "$slug" "$runtime" "$name"
    i=$((i + 1))
  done
}

select_tool_manifest() {
  SELECTED_MANIFEST=""
  load_tools

  if [ "${#TOOL_MANIFESTS[@]}" -eq 0 ]; then
    echo "No tools found."
    return 1
  fi

  if use_gum; then
    label=$(gum choose --header "Run tool" "${TOOL_LABELS[@]}") || return 1
  else
    echo "Run tool"
    i=0
    while [ "$i" -lt "${#TOOL_LABELS[@]}" ]; do
      printf "%d. %s\n" "$((i + 1))" "${TOOL_LABELS[$i]}"
      i=$((i + 1))
    done
    printf "Choose: "
    read -r choice
    case "$choice" in
      ''|*[!0-9]*) return 1 ;;
    esac
    if [ "$choice" -lt 1 ] || [ "$choice" -gt "${#TOOL_LABELS[@]}" ]; then
      return 1
    fi
    label=${TOOL_LABELS[$((choice - 1))]}
  fi

  i=0
  while [ "$i" -lt "${#TOOL_LABELS[@]}" ]; do
    if [ "${TOOL_LABELS[$i]}" = "$label" ]; then
      SELECTED_MANIFEST=${TOOL_MANIFESTS[$i]}
      return 0
    fi
    i=$((i + 1))
  done

  return 1
}

run_tool() {
  select_tool_manifest || return
  manifest=$SELECTED_MANIFEST
  dir=$(dirname "$manifest")
  entry=$(json_value "$manifest" "entry")
  runtime=$(json_value "$manifest" "runtime")
  name=$(json_value "$manifest" "name")

  if [ "$runtime" = "readme" ] || [ -z "$entry" ]; then
    echo
    echo "$name is a README-only tool."
    echo "$dir/README.md"
    return
  fi

  if [ ! -f "$dir/$entry" ]; then
    echo "Missing entry file: $dir/$entry"
    return 1
  fi

  echo
  echo "Running $name"
  echo

  case "$runtime" in
    bash)
      (cd "$dir" && bash "./$entry")
      ;;
    node)
      if ! has node; then
        echo "Missing dependency: node"
        echo "This tool owns its own runtime requirement."
        return 1
      fi
      (cd "$dir" && node "./$entry")
      ;;
    *)
      echo "Unsupported runtime: $runtime"
      return 1
      ;;
  esac
}

prompt_text() {
  label=$1
  if use_gum; then
    gum input --prompt "$label: "
  else
    printf "%s: " "$label"
    read -r value
    printf "%s" "$value"
  fi
}

prompt_multiline_description() {
  if use_gum; then
    gum input --prompt "Description: "
  else
    printf "Description: "
    read -r value
    printf "%s" "$value"
  fi
}

prompt_yes_no() {
  label=$1
  if use_gum; then
    if gum confirm "$label"; then
      printf "yes"
    else
      printf "no"
    fi
  else
    printf "%s [y/N]: " "$label"
    read -r answer
    case "$answer" in
      y|Y|yes|YES) printf "yes" ;;
      *) printf "no" ;;
    esac
  fi
}

write_tool_readme() {
  file=$1
  name=$2
  description=$3
  runtime=$4
  entry=$5

  if [ "$runtime" = "readme" ]; then
    cat > "$file" <<EOF
# $name

$description

## Notes

- Add the checklist or workflow here.
EOF
  else
    cat > "$file" <<EOF
# $name

$description

## Usage

\`\`\`bash
./$entry
\`\`\`

## Dependencies

- $runtime
EOF
  fi
}

write_entry_file() {
  file=$1
  runtime=$2
  name=$3

  case "$runtime" in
    bash)
      cat > "$file" <<EOF
#!/usr/bin/env bash
set -euo pipefail

echo "$name"
echo "TODO: Implement this tool."
EOF
      chmod +x "$file"
      ;;
    node)
      cat > "$file" <<EOF
#!/usr/bin/env node

console.log("$name");
console.log("TODO: Implement this tool.");
EOF
      chmod +x "$file"
      ;;
  esac
}

create_tool() {
  echo
  name=$(prompt_text "Name")
  slug=$(slugify "$name")

  if [ -z "$slug" ]; then
    echo "Name must produce a non-empty slug."
    return 1
  fi

  intent=$(choose_option "Intent" $INTENTS) || return 1
  if [ "$intent" = "custom" ]; then
    intent=$(prompt_text "Custom intent")
    intent=$(slugify "$intent")
  fi

  if [ -z "$intent" ]; then
    echo "Intent must be non-empty."
    return 1
  fi

  description=$(prompt_multiline_description)
  runtime=$(choose_option "Runtime" $RUNTIMES) || return 1
  tags_input=$(prompt_text "Tags, comma-separated")
  status=$(choose_option "Status" $STATUSES) || return 1
  ai_generated=$(prompt_yes_no "Is this tool AI-generated?")

  sample_tag=no
  if [ "$status" = "sample" ]; then
    sample_tag=yes
  fi

  tags=$(normalize_tags "$tags_input" "$ai_generated" "$sample_tag")
  tool_dir="$ROOT/tools/$intent/$slug"

  if [ -e "$tool_dir" ]; then
    echo "Tool already exists: $tool_dir"
    return 1
  fi

  mkdir -p "$tool_dir"

  entry=""
  if [ "$runtime" = "bash" ]; then
    entry="$slug.sh"
  elif [ "$runtime" = "node" ]; then
    entry="$slug.mjs"
  fi

  write_tool_readme "$tool_dir/README.md" "$name" "$description" "$runtime" "$entry"

  {
    echo "{"
    echo "  \"name\": \"$(json_escape "$name")\","
    echo "  \"slug\": \"$(json_escape "$slug")\","
    echo "  \"intent\": \"$(json_escape "$intent")\","
    echo "  \"description\": \"$(json_escape "$description")\","
    echo "  \"entry\": \"$(json_escape "$entry")\","
    echo "  \"runtime\": \"$(json_escape "$runtime")\","
    echo "  \"tags\": $(tags_json "$tags"),"
    echo "  \"status\": \"$(json_escape "$status")\""
    echo "}"
  } > "$tool_dir/manifest.json"

  if [ -n "$entry" ]; then
    write_entry_file "$tool_dir/$entry" "$runtime" "$name"
  fi

  echo
  echo "Created: tools/$intent/$slug"
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
      1) echo; list_tools; pause ;;
      2) echo; run_tool; pause ;;
      3) create_tool; pause ;;
      4) exit 0 ;;
      *) echo "Unknown choice."; pause ;;
    esac
  done
}

run_menu_gum() {
  while true; do
    clear 2>/dev/null || true

    choice=$(gum choose --header "toolbox" "List tools" "Run tool" "Create tool" "Exit") || exit 0

    case "$choice" in
      "List tools") echo; list_tools; pause ;;
      "Run tool") echo; run_tool; pause ;;
      "Create tool") create_tool; pause ;;
      "Exit") exit 0 ;;
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

if use_gum; then
  run_menu_gum
else
  run_menu_numbered
fi
