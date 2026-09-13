#!/usr/bin/env python3
"""Reconstruct an isolated release; never edits the original checkout or deploys."""
from pathlib import Path
import argparse, hashlib, json, shutil, subprocess, os
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',required=True,type=Path)
parser.add_argument('--destination',required=True,type=Path)
args=parser.parse_args()
source=args.source.resolve();destination=args.destination.resolve();bundle=Path(__file__).resolve().parent
if destination.exists():parser.error('Choose a new, nonexistent destination directory.')
if source==destination or source in destination.parents:parser.error('Destination must be outside the source checkout.')
manifest=json.loads((bundle/'manifest.json').read_text())
for entry in manifest['files']:
 name=entry['path']; content=(bundle/'implementation'/name).read_bytes()
 if hashlib.sha256(content).hexdigest()!=entry['sha256']:parser.error('Bundle integrity check failed: '+name)
 if entry['base_sha256']:
  old=source/name
  if not old.exists() or hashlib.sha256(old.read_bytes()).hexdigest()!=entry['base_sha256']:parser.error('Source changed since review; reconcile this file before rebuilding: '+name)
files=subprocess.check_output(['git','ls-files','-z'],cwd=source).decode().split('\0')
destination.mkdir(parents=True)
for name in files:
 if not name or name.startswith(('.netlify/','node_modules/','.env')):continue
 old=source/name
 if old.is_file():
  target=destination/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(old,target)
for entry in manifest['files']:
 name=entry['path'];target=destination/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(bundle/'implementation'/name,target)
if (source/'node_modules').exists():os.symlink(source/'node_modules',destination/'node_modules',target_is_directory=True)
print('Isolated release created at',destination)
print('Run npm run publication:preview there. No deployment or service mutation occurred.')
