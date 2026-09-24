import React from 'react';
import {
  FileCode,
  FileText,
  FileJson,
  File,
  Folder,
  FolderOpen,
  Code2,
  Database,
  Hash,
  Terminal,
} from 'lucide-react';

export default function FileIcon({ filename, isFolder, isOpen, size = 16, className = '' }) {
  if (isFolder) {
    return isOpen ? (
      <FolderOpen size={size} color="#e5c07b" className={className} />
    ) : (
      <Folder size={size} color="#dcb67a" className={className} />
    );
  }

  const ext = filename?.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'java':
      return <CoffeeIcon size={size} className={className} />;
    case 'py':
      return <PythonIcon size={size} className={className} />;
    case 'js':
    case 'mjs':
    case 'cjs':
      return <FileCode size={size} color="#f7df1e" className={className} />;
    case 'jsx':
      return <ReactIcon size={size} color="#61dafb" className={className} />;
    case 'ts':
      return <FileCode size={size} color="#3178c6" className={className} />;
    case 'tsx':
      return <ReactIcon size={size} color="#3178c6" className={className} />;
    case 'html':
    case 'htm':
      return <Code2 size={size} color="#e34f26" className={className} />;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <Hash size={size} color="#2965f1" className={className} />;
    case 'json':
      return <FileJson size={size} color="#cbcb41" className={className} />;
    case 'md':
    case 'markdown':
      return <FileText size={size} color="#42a5f5" className={className} />;
    case 'sql':
      return <Database size={size} color="#00bcd4" className={className} />;
    case 'sh':
    case 'bash':
    case 'zsh':
      return <Terminal size={size} color="#4caf50" className={className} />;
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'c':
    case 'h':
    case 'hpp':
      return <FileCode size={size} color="#a855f7" className={className} />;
    case 'txt':
    case 'log':
      return <FileText size={size} color="#9e9e9e" className={className} />;
    default:
      return <File size={size} color="#858585" className={className} />;
  }
}

// Java coffee cup icon
function CoffeeIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ea580c"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" x2="6" y1="2" y2="4" />
      <line x1="10" x2="10" y1="2" y2="4" />
      <line x1="14" x2="14" y1="2" y2="4" />
    </svg>
  );
}

// Python snake icon
function PythonIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2c4 0 4 2 4 4v2H8V6c0-2 0-4 4-4Z" stroke="#3b82f6" />
      <path d="M12 22c-4 0-4-2-4-4v-2h8v2c0 2 0 4-4 4Z" stroke="#eab308" />
      <circle cx="10" cy="5" r="0.8" fill="#3b82f6" />
      <circle cx="14" cy="19" r="0.8" fill="#eab308" />
      <path d="M4 10h10a2 2 0 0 1 2 2v2" stroke="#3b82f6" />
      <path d="M20 14H10a2 2 0 0 1-2-2v-2" stroke="#eab308" />
    </svg>
  );
}

// React atom icon
function ReactIcon({ size = 16, color = '#61dafb', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(90 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(150 12 12)" />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  );
}
