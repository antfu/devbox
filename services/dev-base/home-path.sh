# Login shells reset PATH in /etc/profile. This puts back the home's command folders (see the Dockerfile),
# where global installs persist, and cargo's, ahead of the image's own.
for dir in /opt/cargo/bin "$PNPM_HOME" "$HOME/.local/bin"; do
  case ":$PATH:" in
    *":$dir:"*) ;;
    *) [ -n "$dir" ] && PATH="$dir:$PATH" ;;
  esac
done
export PATH
unset dir
