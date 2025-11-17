#!/usr/bin/env bash
#
# Doctor script - Check if all required tools are installed and up to date
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Symbols
CHECK="✓"
CROSS="✗"
WARNING="⚠"
INFO="ℹ"

# Track overall status
ALL_OK=true

# Minimum required versions
MIN_NODE_VERSION="22.12.0"
MIN_NPM_VERSION="9.0.0"
MIN_GIT_VERSION="2.30.0"
MIN_PODMAN_VERSION="4.0.0"

print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  Discord Claude CLI Bot - Environment Check${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}$(printf '=%.0s' {1..50})${NC}"
}

check_command() {
    local cmd=$1
    local name=$2
    local min_version=$3
    local install_cmd=$4

    echo -n "Checking $name... "

    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}${CROSS} Not installed${NC}"
        echo -e "${YELLOW}  Install: $install_cmd${NC}"
        ALL_OK=false
        return 1
    fi

    local version
    case "$cmd" in
        node)
            version=$(node --version | sed 's/v//')
            ;;
        npm)
            version=$(npm --version)
            ;;
        git)
            version=$(git --version | awk '{print $3}')
            ;;
        podman)
            version=$(podman --version | awk '{print $3}')
            ;;
        podman-compose)
            version=$(podman-compose --version 2>/dev/null | grep "podman-compose version" | awk '{print $3}')
            ;;
        task)
            version=$(task --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
            ;;
        *)
            version="unknown"
            ;;
    esac

    echo -e "${GREEN}${CHECK} Installed${NC}"
    echo -e "  Version: $version"

    # Detect install method for specific commands
    if [[ "$cmd" == "podman" ]] || [[ "$cmd" == "podman-compose" ]] || [[ "$cmd" == "task" ]]; then
        local method=$(detect_install_method "$cmd")
        if [ "$method" != "unknown" ]; then
            echo -e "  Installed via: $method"
        fi
    fi

    if [ -n "$min_version" ] && [ "$version" != "unknown" ]; then
        if version_compare "$version" "$min_version"; then
            echo -e "  ${GREEN}${CHECK} Version OK (>= $min_version)${NC}"
        else
            echo -e "  ${RED}${CROSS} Version too old (minimum: $min_version)${NC}"
            echo -e "${YELLOW}  Update: $install_cmd${NC}"
            ALL_OK=false
        fi
    fi
}

version_compare() {
    local version=$1
    local min_version=$2

    # Simple version comparison (works for semantic versioning)
    if [ "$(printf '%s\n' "$min_version" "$version" | sort -V | head -n1)" = "$min_version" ]; then
        return 0  # version >= min_version
    else
        return 1  # version < min_version
    fi
}

detect_install_method() {
    local cmd=$1
    local install_method="unknown"

    # Get the full path of the command
    local cmd_path=$(which "$cmd" 2>/dev/null)

    if [ -z "$cmd_path" ]; then
        echo "unknown"
        return
    fi

    case "$cmd" in
        podman)
            # Check if installed via Homebrew (macOS)
            if [[ "$cmd_path" == /opt/homebrew/* ]] || [[ "$cmd_path" == /usr/local/* ]]; then
                if command -v brew &> /dev/null; then
                    if brew list --formula 2>/dev/null | grep -q "^podman$"; then
                        install_method="Homebrew"
                    fi
                fi
            # Check if installed via apt (Debian/Ubuntu)
            elif command -v dpkg &> /dev/null; then
                if dpkg -l 2>/dev/null | grep -q "^ii.*podman"; then
                    install_method="apt"
                fi
            # Check if installed via dnf/yum (Fedora/RHEL)
            elif command -v rpm &> /dev/null; then
                if rpm -qa 2>/dev/null | grep -q "^podman"; then
                    install_method="dnf/yum"
                fi
            # Check if installed via pacman (Arch Linux)
            elif command -v pacman &> /dev/null; then
                if pacman -Q podman &> /dev/null; then
                    install_method="pacman"
                fi
            fi
            ;;
        podman-compose)
            # Check if installed via Homebrew (macOS)
            if [[ "$cmd_path" == /opt/homebrew/* ]] || [[ "$cmd_path" == /usr/local/* ]]; then
                if command -v brew &> /dev/null; then
                    if brew list --formula 2>/dev/null | grep -q "^podman-compose$"; then
                        install_method="Homebrew"
                    fi
                fi
            fi

            # If not Homebrew, check if installed via pip/pip3
            if [ "$install_method" = "unknown" ]; then
                if command -v pip3 &> /dev/null; then
                    if pip3 list 2>/dev/null | grep -q "^podman-compose"; then
                        install_method="pip3"
                    fi
                elif command -v pip &> /dev/null; then
                    if pip list 2>/dev/null | grep -q "^podman-compose"; then
                        install_method="pip"
                    fi
                fi
            fi
            ;;
        task)
            # Check if installed via Homebrew
            if [[ "$cmd_path" == /opt/homebrew/* ]] || [[ "$cmd_path" == /usr/local/* ]]; then
                if command -v brew &> /dev/null; then
                    if brew list --formula 2>/dev/null | grep -q "go-task"; then
                        install_method="Homebrew"
                    fi
                fi
            fi
            ;;
    esac

    echo "$install_method"
}

check_file() {
    local file=$1
    local name=$2
    local create_cmd=$3

    echo -n "Checking $name... "

    if [ -f "$file" ]; then
        echo -e "${GREEN}${CHECK} Found${NC}"
        echo -e "  Path: $file"
        return 0
    else
        echo -e "${RED}${CROSS} Not found${NC}"
        if [ -n "$create_cmd" ]; then
            echo -e "${YELLOW}  Create: $create_cmd${NC}"
        fi
        ALL_OK=false
        return 1
    fi
}

check_env_file() {
    echo -n "Checking .env.docker file... "

    if [ ! -f ".env.docker" ]; then
        echo -e "${RED}${CROSS} Not found${NC}"
        echo -e "${YELLOW}  Create: cp .env.docker.example .env.docker${NC}"
        echo -e "${YELLOW}  Or run: task env:setup${NC}"
        ALL_OK=false
        return 1
    fi

    echo -e "${GREEN}${CHECK} Found${NC}"

    # Check required variables
    local required_vars=("DISCORD_BOT_TOKEN" "GIT_REPOSITORY_URL")
    local missing_vars=()
    local default_vars=()

    # Check if either CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY is set
    local has_anthropic_auth=false
    if grep -q "^CLAUDE_CODE_OAUTH_TOKEN=.\\+" .env.docker || grep -q "^ANTHROPIC_API_KEY=.\\+" .env.docker; then
        has_anthropic_auth=true
    fi

    # Common default/placeholder patterns
    local default_patterns=(
        "yourusername"
        "yourrepo"
        "your-email@example.com"
        "your_discord_bot_token"
        "your_anthropic_api_key"
        "gh auth login"
        "example.com"
        "https://github.com/yourusername"
    )

    for var in "${required_vars[@]}"; do
        # Check if variable is missing or empty
        if ! grep -q "^${var}=" .env.docker || \
           grep -q "^${var}=$" .env.docker || \
           grep -q "^${var}=your_" .env.docker || \
           grep -q "^${var}=<" .env.docker; then
            missing_vars+=("$var")
            continue
        fi

        # Check if variable contains default/placeholder patterns
        local value=$(grep "^${var}=" .env.docker | cut -d'=' -f2-)
        for pattern in "${default_patterns[@]}"; do
            if [[ "$value" == *"$pattern"* ]]; then
                default_vars+=("$var (contains: $pattern)")
                break
            fi
        done
    done

    local has_issues=false

    # Check Anthropic authentication
    if [ "$has_anthropic_auth" = false ]; then
        echo -e "  ${RED}${CROSS} Anthropic authentication not configured${NC}"
        echo -e "    Set either CLAUDE_CODE_OAUTH_TOKEN (OAuth) or ANTHROPIC_API_KEY"
        has_issues=true
    else
        echo -e "  ${GREEN}${CHECK} Anthropic authentication configured${NC}"
    fi

    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo -e "  ${RED}${CROSS} Missing or empty variables:${NC}"
        for var in "${missing_vars[@]}"; do
            echo -e "    - $var"
        done
        has_issues=true
    fi

    if [ ${#default_vars[@]} -gt 0 ]; then
        echo -e "  ${YELLOW}${CROSS} Variables with default/placeholder values:${NC}"
        for var in "${default_vars[@]}"; do
            echo -e "    - $var"
        done
        echo -e "${YELLOW}  Please update these with actual values${NC}"
        has_issues=true
    fi

    if [ "$has_issues" = false ]; then
        echo -e "  ${GREEN}${CHECK} All required variables are properly configured${NC}"
    else
        echo -e "${YELLOW}  Edit .env.docker and set real values for these variables${NC}"
        ALL_OK=false
    fi
}

check_directories() {
    local dirs=("./volumes/logs" "./volumes/repo")

    echo "Checking volume directories..."

    for dir in "${dirs[@]}"; do
        echo -n "  $dir... "
        if [ -d "$dir" ]; then
            echo -e "${GREEN}${CHECK}${NC}"
        else
            echo -e "${YELLOW}${WARNING} Not found${NC}"
            echo -e "    ${YELLOW}Will be created automatically by 'task up'${NC}"
        fi
    done
}

check_podman_machine() {
    echo -n "Checking Podman machine... "

    # Check if we're on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo -e "${GREEN}${CHECK} Not required (Linux)${NC}"
        return 0
    fi

    # On macOS, check if podman machine is running
    if ! podman machine list &> /dev/null; then
        echo -e "${YELLOW}${WARNING} Podman machine not initialized${NC}"
        echo -e "${YELLOW}  Initialize: podman machine init${NC}"
        echo -e "${YELLOW}  Start: podman machine start${NC}"
        ALL_OK=false
        return 1
    fi

    local machine_status=$(podman machine list --format "{{.Running}}" 2>/dev/null | head -n1)

    if [ "$machine_status" = "true" ]; then
        echo -e "${GREEN}${CHECK} Running${NC}"
        local machine_name=$(podman machine list --format "{{.Name}}" 2>/dev/null | head -n1)
        echo -e "  Machine: $machine_name"
    else
        echo -e "${YELLOW}${WARNING} Not running${NC}"
        echo -e "${YELLOW}  Start: podman machine start${NC}"
        ALL_OK=false
    fi
}

check_npm_packages() {
    echo -n "Checking npm packages... "

    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}${WARNING} Not installed${NC}"
        echo -e "${YELLOW}  Install: npm install${NC}"
        ALL_OK=false
        return 1
    fi

    echo -e "${GREEN}${CHECK} Installed${NC}"

    # Check if package-lock.json is in sync
    if [ -f "package-lock.json" ]; then
        if [ "package.json" -nt "node_modules" ]; then
            echo -e "  ${YELLOW}${WARNING} package.json is newer than node_modules${NC}"
            echo -e "    ${YELLOW}Run: npm install${NC}"
            ALL_OK=false
        fi
    fi
}

print_install_instructions() {
    local os_type=$(uname -s)

    echo ""
    echo -e "${BLUE}Installation Instructions:${NC}"
    echo ""

    case "$os_type" in
        Darwin)
            echo -e "${GREEN}macOS detected${NC}"
            echo ""
            echo "Using Homebrew (recommended):"
            echo "  brew install node@22"
            echo "  brew install git"
            echo "  brew install podman"
            echo "  brew install go-task/tap/go-task"
            echo ""
            echo "Initialize Podman machine:"
            echo "  podman machine init"
            echo "  podman machine start"
            ;;
        Linux)
            echo -e "${GREEN}Linux detected${NC}"
            echo ""
            echo "Node.js (using nvm - recommended):"
            echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            echo "  nvm install 22"
            echo "  nvm use 22"
            echo ""
            echo "Podman (Ubuntu/Debian):"
            echo "  sudo apt-get update"
            echo "  sudo apt-get install -y podman"
            echo ""
            echo "Podman (Fedora/RHEL):"
            echo "  sudo dnf install -y podman"
            echo ""
            echo "Task (go-task):"
            echo "  sudo sh -c 'curl -sL https://taskfile.dev/install.sh | sh'"
            ;;
        *)
            echo -e "${YELLOW}Unknown OS: $os_type${NC}"
            echo "Please refer to official documentation for installation instructions."
            ;;
    esac

    echo ""
    echo "Official documentation:"
    echo "  Node.js: https://nodejs.org/"
    echo "  Podman: https://podman.io/getting-started/installation"
    echo "  Task: https://taskfile.dev/installation/"
    echo "  Git: https://git-scm.com/downloads"
}

print_summary() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  Summary${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""

    if [ "$ALL_OK" = true ]; then
        echo -e "${GREEN}${CHECK} All checks passed!${NC}"
        echo ""
        echo "You're ready to build and run the Discord Claude CLI Bot."
        echo ""
        echo "Next steps:"
        echo "  1. Ensure .env.docker is configured: task env:check"
        echo "  2. Build the image: task build"
        echo "  3. Start the bot: task up"
        echo "  4. View logs: task logs:follow"
        echo ""
    else
        echo -e "${RED}${CROSS} Some checks failed${NC}"
        echo ""
        echo "Please install missing dependencies and fix configuration issues."
        echo "Run 'task doctor' again after making changes."
        echo ""
    fi
}

# Main execution
main() {
    print_header

    # Check required commands
    print_section "Required Software"
    check_command "node" "Node.js" "$MIN_NODE_VERSION" "brew install node@22  (or use nvm)"
    check_command "npm" "npm" "$MIN_NPM_VERSION" "Installed with Node.js"
    check_command "git" "Git" "$MIN_GIT_VERSION" "brew install git  (or use system package manager)"
    check_command "podman" "Podman" "$MIN_PODMAN_VERSION" "brew install podman  (macOS) or apt-get install podman (Linux)"

    # Detect podman install method for later use
    local podman_install_method=$(detect_install_method "podman")

    # Check optional but recommended commands
    print_section "Optional Tools"
    check_command "task" "Task (go-task)" "" "brew install go-task/tap/go-task  (or see https://taskfile.dev)"

    # Suggest podman-compose installation method based on podman's installation
    local compose_install_cmd
    if [ "$podman_install_method" = "Homebrew" ]; then
        compose_install_cmd="brew install podman-compose  (recommended for Homebrew users)"
    else
        compose_install_cmd="pip3 install podman-compose  (or brew install podman-compose on macOS)"
    fi
    check_command "podman-compose" "Podman Compose" "" "$compose_install_cmd"

    # Check Podman machine (macOS only)
    print_section "Podman Configuration"
    check_podman_machine

    # Check project files
    print_section "Project Configuration"
    check_file ".env.docker.example" ".env.docker.example" "Should exist in repository"
    check_env_file
    check_file "Dockerfile" "Dockerfile" "Should exist in repository"
    check_file "package.json" "package.json" "Should exist in repository"
    check_file "Taskfile.yml" "Taskfile.yml" "Should exist in repository"

    # Check directories
    print_section "Project Directories"
    check_directories

    # Check npm packages
    print_section "Dependencies"
    check_npm_packages

    # Print installation instructions if needed
    if [ "$ALL_OK" = false ]; then
        print_install_instructions
    fi

    # Print summary
    print_summary

    # Exit with appropriate code
    if [ "$ALL_OK" = true ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main
