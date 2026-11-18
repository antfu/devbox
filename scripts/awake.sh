#!/bin/sh
# Keep the MacBook awake with the lid closed, but only on the charger.
# `disablesleep` has no per-power-source form, so a root LaunchDaemon sets it
# from the power source every few seconds. Usage: awake.sh install | uninstall
set -eu

label=dev.devbox.awake
plist=/Library/LaunchDaemons/$label.plist

[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"

case "${1:-}" in
  install)
    pmset -c sleep 0 autorestart 1 womp 1
    cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>last=; while :; do if pmset -g batt | grep -q "AC Power"; then want=1; else want=0; fi; [ "\$want" = "\$last" ] || { pmset -a disablesleep \$want; last=\$want; }; sleep 5; done</string>
  </array>
</dict>
</plist>
PLIST
    chown root:wheel "$plist"
    chmod 644 "$plist"
    launchctl bootout system "$plist" 2>/dev/null || true
    launchctl bootstrap system "$plist"
    echo "Installed $label: disablesleep follows the charger."
    ;;
  uninstall)
    launchctl bootout system "$plist" 2>/dev/null || true
    rm -f "$plist"
    pmset -a disablesleep 0
    echo "Removed $label and set disablesleep 0."
    ;;
  *)
    echo "Usage: $0 install | uninstall" >&2
    exit 1
    ;;
esac
