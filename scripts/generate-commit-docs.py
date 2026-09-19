#!/usr/bin/env python3
"""
Git Commit Documentation Generator (Python Version)
Fetches commits from main branch and generates markdown files
Usage: python3 generate-commit-docs.py
"""

import os
import sys
import subprocess
import re
from datetime import datetime
from pathlib import Path
import logging

# Configuration
DOCS_DIR = "docs/_docs"
BRANCH = "main"
LOG_FILE = "docs/commit-docs.log"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

class CommitDocGenerator:
    def __init__(self):
        self.docs_dir = Path(DOCS_DIR)
        self.repo_root = Path(".")
        
    def sanitize_title(self, text):
        """Sanitize text for use in titles"""
        sanitized = re.sub(r'[^a-zA-Z0-9\s-]', '', text)
        sanitized = re.sub(r'\s+', ' ', sanitized)
        sanitized = sanitized.strip()
        return sanitized
    
    def escape_yaml_string(self, text):
        """Escape a string for safe use in YAML front matter"""
        if not text:
            return '""'
        
        # If the string contains quotes, backslashes, or other special YAML characters,
        # we need to escape them or use literal block style
        if '"' in text or '\\' in text or '\n' in text or '\r' in text:
            # Escape quotes and backslashes
            escaped = text.replace('\\', '\\\\').replace('"', '\\"')
            return f'"{escaped}"'
        else:
            # Safe to use as-is with quotes
            return f'"{text}"'
    
    def jekyll_url_sanitize(self, filename_stem):
        """Convert filename stem to Jekyll-style URL format (lowercase with hyphens)"""
        # Jekyll converts filenames to lowercase and replaces underscores with hyphens
        url_safe = filename_stem.lower().replace('_', '-')
        return url_safe
    
    def sanitize_filename(self, text):
        """Sanitize text for use in filenames"""
        sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', text)
        sanitized = re.sub(r'_+', '_', sanitized)
        if len(sanitized) > 127:
            sanitized = sanitized[:127]
        return sanitized.strip('_')
    
    def run_git_command(self, command):
        """Run a git command and return the output"""
        try:
            result = subprocess.run(
                command.split(),
                capture_output=True,
                text=True,
                check=True,
                cwd=self.repo_root
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            logger.error(f"Git command failed: {command}")
            logger.error(f"Error: {e.stderr}")
            return None
    
    def validate_repository(self):
        """Validate that we're in a Git repository"""
        if not (self.repo_root / ".git").exists():
            logger.error("Not a Git repository. Please run from repository root.")
            sys.exit(1)
        
        # Check if main branch exists
        result = self.run_git_command("git show-ref --verify --quiet refs/heads/main")
        if result is None:
            logger.warning("Main branch not found locally. Fetching from remote...")
            fetch_result = self.run_git_command("git fetch origin main:main")
            if fetch_result is None:
                logger.error("Failed to fetch main branch")
                sys.exit(1)
    
    def get_latest_documented_commit(self):
        """Get the latest commit hash from existing documentation"""
        if not self.docs_dir.exists():
            return None
        
        md_files = list(self.docs_dir.glob("*.md"))
        if not md_files:
            return None
        
        # Find the most recent file
        latest_file = max(md_files, key=lambda f: f.stat().st_mtime)
        
        try:
            with open(latest_file, 'r', encoding='utf-8') as f:
                content = f.read()
                match = re.search(r'^commit_hash:\s*(.+)$', content, re.MULTILINE)
                if match:
                    return match.group(1).strip('"')
        except Exception as e:
            logger.warning(f"Could not read latest commit from {latest_file}: {e}")
        
        return None
    
    def get_commits(self, since_commit=None):
        """Get list of commits to process"""
        if since_commit:
            logger.info(f"Fetching commits since {since_commit}")
            command = f"git log main --pretty=format:%H|%ci|%s|%an --reverse {since_commit}..HEAD"
        else:
            logger.info("Fetching all commits...")
            command = "git log main --pretty=format:%H|%ci|%s|%an --reverse"
        
        output = self.run_git_command(command)
        if not output:
            return []
        
        commits = []
        for line in output.split('\n'):
            if line.strip():
                parts = line.split('|', 3)
                if len(parts) == 4:
                    commits.append({
                        'hash': parts[0],
                        'date': parts[1],
                        'title': parts[2],
                        'author': parts[3]
                    })
        
        return commits
    
    def get_commit_message(self, commit_hash):
        """Get full commit message"""
        command = f"git log -1 --pretty=format:%B {commit_hash}"
        return self.run_git_command(command) or ""
    
    def get_files_changed(self, commit_hash):
        """Get list of files changed in a commit"""
        command = f"git show --name-status --pretty=format: {commit_hash}"
        output = self.run_git_command(command)
        
        if not output:
            return "No files changed in this commit."
        
        files_md = []
        for line in output.split('\n'):
            line = line.strip()
            if not line:
                continue
            
            parts = line.split('\t', 1)
            if len(parts) != 2:
                continue
            
            status, filename = parts
            
            if status == 'A':
                files_md.append(f"- ✅ **Added:** `{filename}`")
            elif status == 'M':
                files_md.append(f"- 📝 **Modified:** `{filename}`")
            elif status == 'D':
                files_md.append(f"- ❌ **Deleted:** `{filename}`")
            elif status.startswith('R'):
                files_md.append(f"- 🔄 **Renamed:** `{filename}`")
            elif status.startswith('C'):
                files_md.append(f"- 📋 **Copied:** `{filename}`")
            else:
                files_md.append(f"- 📄 **Changed:** `{filename}`")
        
        return '\n'.join(files_md) if files_md else "No files changed in this commit."
    
    def generate_markdown(self, commit):
        """Generate markdown content for a commit"""
        commit_message = self.get_commit_message(commit['hash'])
        files_changed = self.get_files_changed(commit['hash'])
        
        # Format date for filename
        try:
            date_obj = datetime.fromisoformat(commit['date'].replace(' ', 'T', 1))
            file_date = date_obj.strftime('%Y%m%d%H%M%S')
        except:
            file_date = re.sub(r'[^0-9]', '', commit['date'])[:14]
        
        # Create filename
        safe_title = self.sanitize_filename(commit['title'])
        short_hash = commit['hash'][:7]
        filename = f"{file_date}-{short_hash}-{safe_title}.md"

        safe_title_text = self.sanitize_title(commit['title'])
        escaped_title = self.escape_yaml_string(commit['title'])
        escaped_author = self.escape_yaml_string(commit['author'])
        
        # Generate content
        content = f"""---
layout: default
title: {escaped_title}
date: {commit['date']}
author: {escaped_author}
commit_hash: {commit['hash']}
nav_exclude: true
---

# {commit['title']}

**Commit:** `{commit['hash']}`  
**Date:** {commit['date']}  
**Author:** {commit['author']}  

## Commit Message

```
{commit_message}
```

## Files Changed

{files_changed}

## Links

- [View commit on GitHub](https://github.com/museumwithnofrontiers/inventory-app/commit/{commit['hash']})
- [Browse repository at this commit](https://github.com/museumwithnofrontiers/inventory-app/tree/{commit['hash']})

---

*This documentation was automatically generated from Git commit data.*
"""
        
        return filename, content
    
    def generate_index(self):
        """Generate index file for the documentation"""
        index_content = """---
layout: default
title: Commit Documentation
nav_exclude: true
---

# Commit Documentation

This directory contains automatically generated documentation for each commit to the main branch.

## Recent Commits

"""
        
        # Get recent markdown files (excluding index.md)
        md_files = [f for f in self.docs_dir.glob("*.md") if f.name != "index.md"]
        md_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        
        for md_file in md_files[:20]:  # Last 20 commits
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Handle both quoted and escaped quoted titles
                    title_match = re.search(r'^title:\s*"((?:[^"\\]|\\.)*)"\s*$', content, re.MULTILINE)
                    date_match = re.search(r'^date:\s*(.+)$', content, re.MULTILINE)
                    
                    if title_match and date_match:
                        title = title_match.group(1).replace('\\"', '"').replace('\\\\', '\\')  # Unescape
                        date = date_match.group(1).split()[0]  # Just the date part
                        basename = md_file.stem
                        jekyll_url = self.jekyll_url_sanitize(basename)
                        index_content += f"- [{title}]({{{{ site.baseurl }}}}/commits/{jekyll_url}/) - {date}\n"
            except Exception as e:
                logger.warning(f"Could not process {md_file}: {e}")
        
        index_content += f"\n*Documentation automatically generated on {datetime.now().isoformat()}*\n"
        
        with open(self.docs_dir / "index.md", 'w', encoding='utf-8') as f:
            f.write(index_content)
    
    def run(self):
        """Main execution function"""
        logger.info("Starting Git commit documentation generator...")
        
        # Validate repository
        self.validate_repository()
        
        # Create docs directory
        self.docs_dir.mkdir(exist_ok=True)
        
        # Get latest documented commit
        latest_commit = self.get_latest_documented_commit()
        if latest_commit:
            logger.info(f"Latest documented commit: {latest_commit}")
        else:
            logger.info("No existing documentation found. Processing all commits.")
        
        # Fetch latest changes
        logger.info("Fetching latest changes from remote...")
        fetch_result = self.run_git_command("git fetch origin")
        if fetch_result is None:
            logger.warning("Failed to fetch from remote (continuing with local data)")
        
        # Get commits to process
        commits = self.get_commits(latest_commit)
        
        if not commits:
            logger.info("No new commits to document.")
            return
        
        # Process commits
        logger.info(f"Processing {len(commits)} commits...")
        for i, commit in enumerate(commits, 1):
            logger.info(f"Processing commit {i}/{len(commits)}: {commit['hash']}")
            
            filename, content = self.generate_markdown(commit)
            filepath = self.docs_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            logger.info(f"Generated: {filename}")
        
        # Generate index
        logger.info("Generating documentation index...")
        self.generate_index()
        
        logger.info("Documentation generation completed!")
        logger.info(f"Generated files are in: {self.docs_dir}")

if __name__ == "__main__":
    generator = CommitDocGenerator()
    generator.run()
