#!/usr/bin/env bash
# Reach Companion Android setup helper for Termux
# Make sure to run: pkg install termux-api if you want integrations.

set -e

echo "=== Reach Companion Android Installer for Termux ==="

# 1. Update Termux repositories
echo "Updating packages..."
pkg update -y
pkg upgrade -y

# 2. Install required packages
echo "Installing Node.js, Python, Git, and compiler packages..."
pkg install git nodejs python clang make libffi openssl -y

# 3. Create the python virtual environment
VENV_PATH="$HOME/.agent-reach-venv"
echo "Creating python virtual environment in $VENV_PATH..."
if [ -d "$VENV_PATH" ]; then
    echo "Virtual environment already exists. Skipping creation."
else
    python -m venv "$VENV_PATH"
fi

# 4. Activate virtual environment and install python modules
echo "Installing python packages (agent-reach, twitter_cli, rdt)..."
source "$VENV_PATH/bin/activate"
pip install --upgrade pip
pip install agent-reach twitter_cli rdt

# 5. Install backend dependencies
echo "Installing Node.js dependencies for backend..."
cd "$(dirname "$0")/backend"
npm install

echo "=========================================================="
echo " Setup complete!"
echo "=========================================================="
echo " To run the server:"
echo " 1. Type: termux-wake-lock (prevents your phone from putting the process to sleep)"
echo " 2. Type: node index.js"
echo ""
echo " Keep Termux running in the background and enjoy 24/7 outreach!"
echo "=========================================================="
