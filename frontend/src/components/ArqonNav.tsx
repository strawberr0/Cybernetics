import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Clock, X, ChevronDown, Cpu, Check, Key, AlertCircle, Send, Square } from 'lucide-react'

// ===== UTCClock =====
export function UTCClock({ className = '' }: { className?: string }) {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date): string => {
    const h = date.getUTCHours().toString().padStart(2, '0')
    const m = date.getUTCMinutes().toString().padStart(2, '0')
    const s = date.getUTCSeconds().toString().padStart(2, '0')
    return `${h}:${m}:${s} UTC`
  }

  return (
    <a
      href="https://user.arqon.ai"
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 font-mono text-sm text-[#888888] no-underline cursor-pointer transition-colors duration-200 hover:text-[#00d4ff] ${className}`}
    >
      <Clock size={16} />
      <span>{time ? formatTime(time) : '--:--:-- UTC'}</span>
    </a>
  )
}

// ===== ServiceTitle =====
export function ServiceTitle({
  serviceName,
  faviconUrl = '/favicon.png',
  onClick,
}: {
  serviceName: string
  faviconUrl?: string
  onClick?: () => void
}) {
  const content = (
    <div className="flex items-center gap-2 no-underline transition-opacity duration-200 hover:opacity-80 cursor-pointer">
      <img src={faviconUrl} alt={serviceName} className="h-6 w-6 object-contain" />
      <span className="font-mono font-bold tracking-wide text-base">
        <span className="text-[#07112e] lowercase">{serviceName}</span>
        <span className="text-[#00d4ff]">.Arqon</span>
      </span>
    </div>
  )

  if (onClick) {
    return (
      <button onClick={onClick} className="bg-transparent border-none p-0">
        {content}
      </button>
    )
  }
  return content
}

// ===== ServiceSwitcher =====
interface Service {
  name: string
  url: string
  description: string
  icon: React.ReactNode
}

const services: Service[] = [
  {
    name: 'AGENT',
    url: 'https://agent.arqon.ai',
    description: 'MCP Agent Composer',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" fill="transparent" />
        <rect x="15" y="15" width="50" height="50" stroke="currentColor" strokeWidth="2" rx="4" />
        <circle cx="40" cy="35" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 28 50 Q 28 42 40 42 Q 52 42 52 50" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="40" cy="35" r="3" fill="currentColor" opacity="0.6" />
        <line x1="25" y1="25" x2="30" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="55" y1="25" x2="50" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <rect x="22" y="22" width="6" height="6" stroke="currentColor" strokeWidth="1" opacity="0.4" rx="1" />
        <rect x="52" y="22" width="6" height="6" stroke="currentColor" strokeWidth="1" opacity="0.4" rx="1" />
      </svg>
    ),
  },
  {
    name: 'CHAT',
    url: 'https://chat.arqon.ai',
    description: 'LLM Chat & Web3 Integration',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" fill="transparent" />
        <rect x="10" y="10" width="60" height="60" stroke="currentColor" strokeWidth="2" />
        <rect x="10" y="10" width="60" height="8" fill="currentColor" opacity="0.2" />
        <rect x="15" y="25" width="35" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <rect x="30" y="40" width="35" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.8" />
        <rect x="15" y="55" width="30" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <circle cx="60" cy="25" r="6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: 'CODE',
    url: 'https://code.arqon.ai',
    description: 'Autonomous Development',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" fill="transparent" />
        <rect x="10" y="10" width="60" height="60" stroke="currentColor" strokeWidth="2" />
        <line x1="15" y1="25" x2="40" y2="25" stroke="currentColor" strokeWidth="2" opacity="0.8" />
        <line x1="20" y1="35" x2="38" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="20" y1="45" x2="45" y2="45" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="15" y1="55" x2="35" y2="55" stroke="currentColor" strokeWidth="2" opacity="0.8" />
        <rect x="38" y="52" width="4" height="8" fill="currentColor">
          <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
        </rect>
        <text x="20" y="35" fontFamily="monospace" fontSize="16" fill="currentColor" opacity="0.4">&lt;/&gt;</text>
      </svg>
    ),
  },
  {
    name: 'DESIGN',
    url: 'https://design.arqon.ai',
    description: 'AI SVG Design Studio',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" fill="transparent" />
        <rect x="15" y="15" width="50" height="50" stroke="currentColor" strokeWidth="2" rx="2" />
        <path d="M 25 30 L 35 45 L 55 25" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="35" cy="55" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <rect x="48" y="48" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <path d="M 20 25 Q 20 20 25 20" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <path d="M 55 60 Q 60 60 60 55" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: 'LEGAL',
    url: 'https://legal.arqon.ai',
    description: 'Patent & IP Management',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" fill="transparent" />
        <rect x="38" y="55" width="4" height="15" fill="currentColor" opacity="0.8" />
        <rect x="30" y="68" width="20" height="4" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="15" y="23" width="50" height="3" rx="1" fill="currentColor" />
        <circle cx="40" cy="24" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="20" y1="26" x2="20" y2="38" stroke="currentColor" strokeWidth="1.5" />
        <path d="M 10 38 Q 10 48 20 48 Q 30 48 30 38" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="60" y1="26" x2="60" y2="38" stroke="currentColor" strokeWidth="1.5" />
        <path d="M 50 38 Q 50 48 60 48 Q 70 48 70 38" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="14" y1="42" x2="26" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <line x1="54" y1="42" x2="66" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: 'PUBLISH',
    url: 'https://publish.arqon.ai',
    description: 'AI Content Generation',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" fill="transparent" />
        <rect x="20" y="15" width="40" height="50" stroke="currentColor" strokeWidth="2" rx="2" />
        <line x1="27" y1="25" x2="53" y2="25" stroke="currentColor" strokeWidth="2" opacity="0.8" />
        <line x1="27" y1="35" x2="53" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="27" y1="42" x2="50" y2="42" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="27" y1="49" x2="47" y2="49" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="27" y1="56" x2="45" y2="56" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <path d="M 30 10 L 35 15 L 30 15 Z" fill="currentColor" opacity="0.6" />
      </svg>
    ),
  },
  {
    name: 'SECURITY',
    url: 'https://security.arqon.ai',
    description: 'Threat Detection & Response',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" fill="transparent" />
        <path d="M 40 15 L 60 25 L 60 50 Q 60 65 40 75 Q 20 65 20 50 L 20 25 Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 40 22 L 55 30 L 55 50 Q 55 62 40 70 Q 25 62 25 50 L 25 30 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
        <rect x="35" y="42" width="10" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 37 42 L 37 36 Q 37 32 40 32 Q 43 32 43 36 L 43 42" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="40" cy="48" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'TOOLS',
    url: 'https://tools.arqon.ai',
    description: '+250 Quick Tools',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" fill="transparent" />
        <path d="M 25 20 L 35 20 L 35 35 L 50 35 L 50 20 L 60 20 L 60 60 L 50 60 L 50 45 L 35 45 L 35 60 L 25 60 Z" stroke="currentColor" strokeWidth="2" fill="none" rx="2" />
        <rect x="28" y="25" width="4" height="4" fill="currentColor" opacity="0.6" />
        <rect x="28" y="52" width="4" height="4" fill="currentColor" opacity="0.6" />
        <circle cx="55" cy="52" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="20" y1="40" x2="65" y2="40" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      </svg>
    ),
  },
]

export function ServiceSwitcher({
  isOpen,
  onClose,
  currentService,
}: {
  isOpen: boolean
  onClose: () => void
  currentService?: string
}) {
  if (!isOpen) return null

  const isDark = document.documentElement.classList.contains('dark')

  const handleServiceClick = (url: string) => {
    window.location.href = url
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 1000 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: isDark ? '#0a0a0a' : '#ffffff', border: `1px solid ${isDark ? '#004466' : '#e5e7eb'}`, borderRadius: '12px',
          maxWidth: '900px', width: '90vw', maxHeight: '90vh', zIndex: 1001,
          fontFamily: 'monospace', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ padding: '16px', borderBottom: `1px solid ${isDark ? '#004466' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <p style={{ color: isDark ? '#00d4ff' : '#111827', fontSize: '14px', letterSpacing: '0.15em', fontWeight: 500 }}>
            ARQON APPLICATIONS
          </p>
          <button
            onClick={onClose}
            style={{ color: isDark ? '#00d4ff' : '#6b7280', cursor: 'pointer', padding: '4px', background: 'transparent', border: 'none', display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {services.map((service) => {
              const isCurrent = currentService?.toUpperCase() === service.name
              const borderDefault = isDark ? '#004466' : '#e5e7eb'
              const borderActive = isDark ? '#00d4ff' : '#111827'
              const bgActive = isDark ? 'rgba(0,212,255,0.1)' : 'rgba(0,0,0,0.05)'
              const bgHover = isDark ? 'rgba(0,212,255,0.05)' : 'rgba(0,0,0,0.02)'
              const iconColor = isDark ? '#0099cc' : '#374151'
              const iconColorActive = isDark ? '#00d4ff' : '#111827'
              const descColor = isDark ? '#5a7a8a' : '#9ca3af'

              return (
                <button
                  key={service.name}
                  onClick={() => handleServiceClick(service.url)}
                  style={{
                    padding: '24px', border: `1px solid ${isCurrent ? borderActive : borderDefault}`,
                    borderRadius: '8px', cursor: 'pointer', textAlign: 'center' as const,
                    background: isCurrent ? bgActive : 'transparent',
                    transition: 'all 0.2s', fontFamily: 'monospace',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.background = bgHover
                      e.currentTarget.style.borderColor = borderActive
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = borderDefault
                    }
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{ color: isCurrent ? iconColorActive : iconColor }}>
                      {service.icon}
                    </div>
                    <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.15em', color: isCurrent ? iconColorActive : iconColor }}>
                      {service.name}
                    </p>
                    <p style={{ fontSize: '10px', color: descColor, fontWeight: 300 }}>
                      {service.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ===== NavPageButton (for Composer/MCP nav) =====
export function NavPageButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded transition-colors ${
        active
          ? 'bg-[#07112e] text-white'
          : 'text-[#07112e] hover:bg-[#07112e]/10'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ===== Model Data (inline from GlobalUX llm-models.ts) =====
interface LLMModel {
  id: string
  name: string
  description?: string
  isFree?: boolean
}

interface AIProvider {
  id: string
  name: string
  color: string
  models: LLMModel[]
  keyPlaceholder: string
  supportsLocalMode?: boolean
}

const googleModels: LLMModel[] = [
  { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: 'Latest flash, 1M context' },
  { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Top-tier research, 1M context' },
  { id: 'google/gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', description: 'Fast lightweight variant' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', description: 'Gemini 3 Pro' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast Gemini 3 variant' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Excellent for huge codebases' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, cost-efficient' },
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Lightweight variant' },
  { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B', description: 'Latest Gemma, free tier', isFree: true },
  { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', description: 'Large open model, free tier', isFree: true },
  { id: 'google/gemma-3-12b-it', name: 'Gemma 3 12B', description: 'Medium open model, free tier', isFree: true },
  { id: 'google/gemma-3-4b-it', name: 'Gemma 3 4B', description: 'Lightweight, free tier', isFree: true },
]

const openaiModels: LLMModel[] = [
  { id: 'openai/gpt-5.4-pro', name: 'GPT-5.4 Pro', description: 'Flagship reasoning, 1M context' },
  { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', description: 'Fast flagship, great value' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2', description: 'Advanced reasoning & coding' },
  { id: 'openai/gpt-5.1', name: 'GPT-5.1', description: 'Reliable workhorse' },
  { id: 'openai/gpt-5', name: 'GPT-5', description: 'Previous gen flagship' },
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', description: 'Solid all-rounder' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cost-efficient', isFree: true },
]

const anthropicModels: LLMModel[] = [
  { id: 'anthropic/claude-opus-4.7', name: 'Claude Opus 4.7', description: 'Best writing quality, 1M context' },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', description: 'Premium writing & reasoning, 1M context' },
  { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', description: 'Deep reasoning & agents, 1M context' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Excellent coding model' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Reliable workhorse' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', description: 'Fast & affordable' },
]

const deepseekModels: LLMModel[] = [
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Deep reasoning & analysis' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', description: 'General purpose, great value' },
  { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', description: 'Code-specialized' },
]

const xaiModels: LLMModel[] = [
  { id: 'x-ai/grok-4.3', name: 'Grok 4.3', description: 'Latest flagship, 2M context' },
  { id: 'x-ai/grok-4.20', name: 'Grok 4.20', description: '2M context flagship' },
  { id: 'x-ai/grok-4', name: 'Grok 4', description: 'Web-aware reasoning and coding' },
  { id: 'x-ai/grok-3', name: 'Grok 3', description: 'Flagship coding + reasoning' },
  { id: 'x-ai/grok-3-mini', name: 'Grok 3 Mini', description: 'Lightweight' },
]

const mistralModels: LLMModel[] = [
  { id: 'mistralai/mistral-large-2', name: 'Mistral Large 2', description: 'Flagship reasoning' },
  { id: 'mistralai/codestral-2501', name: 'Codestral 2501', description: 'Code-specialized' },
  { id: 'mistralai/mistral-small', name: 'Mistral Small', description: 'Fast & affordable' },
]

const groqModels: LLMModel[] = [
  { id: 'groq/llama-4-scout-17b', name: 'Llama 4 Scout 17B', description: 'Fast inference', isFree: true },
  { id: 'groq/llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Fast & capable', isFree: true },
  { id: 'groq/llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Ultra-fast', isFree: true },
]

const moonshotModels: LLMModel[] = [
  { id: 'moonshotai/kimi-k2', name: 'Kimi K2', description: 'Long context, 1M tokens' },
  { id: 'moonshotai/kimi-k1.5', name: 'Kimi K1.5', description: 'Reasoning model' },
]

const nvidiaModels: LLMModel[] = [
  { id: 'nvidia/llama-3.1-nemotron-70b', name: 'Llama 3.1 Nemotron 70B', description: 'NVIDIA-tuned' },
  { id: 'nvidia/llama-3.3-nemotron-super-49b', name: 'Nemotron Super 49B', description: 'Optimized inference' },
]

const minimaxModels: LLMModel[] = [
  { id: 'minimax/minimax-m2.7', name: 'MiniMax M2.7', description: 'Long-form specialist, 1M context' },
]

const ollamaModels: LLMModel[] = [
  { id: 'llama3.3', name: 'Llama 3.3 (Local)', description: 'Run locally via Ollama' },
  { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder (Local)', description: 'Code model, local' },
  { id: 'deepseek-r1', name: 'DeepSeek R1 (Local)', description: 'Reasoning, local' },
]

const openrouterAllModels: LLMModel[] = [
  ...deepseekModels,
  ...anthropicModels,
  ...openaiModels,
  ...googleModels,
  ...xaiModels,
  ...mistralModels,
  ...groqModels,
  ...moonshotModels,
  ...minimaxModels,
]

export const AI_PROVIDERS: Record<string, AIProvider> = {
  nvidia: { id: 'nvidia', name: 'NVIDIA NIM', color: '#76b900', models: nvidiaModels, keyPlaceholder: 'nvapi-...' },
  openai: { id: 'openai', name: 'OpenAI', color: '#10a37f', models: openaiModels, keyPlaceholder: 'sk-...' },
  anthropic: { id: 'anthropic', name: 'Anthropic', color: '#d97706', models: anthropicModels, keyPlaceholder: 'sk-ant-...' },
  google: { id: 'google', name: 'Google Gemini', color: '#4285f4', models: googleModels, keyPlaceholder: 'AIza...' },
  xai: { id: 'xai', name: 'xAI (Grok)', color: '#1da1f2', models: xaiModels, keyPlaceholder: 'xai-...' },
  deepseek: { id: 'deepseek', name: 'DeepSeek', color: '#6366f1', models: deepseekModels, keyPlaceholder: 'sk-...' },
  mistral: { id: 'mistral', name: 'Mistral AI', color: '#f97316', models: mistralModels, keyPlaceholder: 'mistral-...' },
  openrouter: { id: 'openrouter', name: 'OpenRouter', color: '#6366f1', models: openrouterAllModels, keyPlaceholder: 'sk-or-...' },
  groq: { id: 'groq', name: 'Groq', color: '#f55036', models: groqModels, keyPlaceholder: 'gsk_...' },
  moonshot: { id: 'moonshot', name: 'Moonshot AI (Kimi)', color: '#fbbf24', models: moonshotModels, keyPlaceholder: 'sk-...' },
  minimax: { id: 'minimax', name: 'MiniMax', color: '#3b82f6', models: minimaxModels, keyPlaceholder: 'sk-...' },
  ollama: { id: 'ollama', name: 'Ollama (Local)', color: '#22c55e', models: ollamaModels, keyPlaceholder: 'No API key required', supportsLocalMode: true },
}

export function getModelsForProvider(providerId: string): LLMModel[] {
  const models = AI_PROVIDERS[providerId]?.models || []
  return [...models].sort((a, b) => {
    if (a.isFree && !b.isFree) return -1
    if (!a.isFree && b.isFree) return 1
    return 0
  })
}

// ===== SecureStorage =====
const SecureStorage = {
  decrypt(value: string): string {
    try { return atob(value) } catch { return value }
  },
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined') return null
      const item = localStorage.getItem(key)
      return item ? this.decrypt(item) : null
    } catch { return null }
  },
}

const getGlobalKey = (provider: string) => `arqon_global_${provider}_api_key`
const getServiceKey = (service: string, provider: string) => `arqon_${service}_${provider}_api_key`

function getAPIKey(serviceName: string, provider: string): string | null {
  const serviceKey = SecureStorage.getItem(getServiceKey(serviceName, provider))
  if (serviceKey) return serviceKey
  return SecureStorage.getItem(getGlobalKey(provider))
}

const FRONTIER_PROVIDERS = ['openai', 'anthropic', 'google', 'xai', 'deepseek', 'mistral', 'nvidia', 'groq', 'moonshot']

function getAvailableProviders(serviceName: string): { provider: AIProvider; hasKey: boolean }[] {
  const result: { provider: AIProvider; hasKey: boolean }[] = []
  for (const providerId of FRONTIER_PROVIDERS) {
    const provider = AI_PROVIDERS[providerId]
    if (provider) result.push({ provider, hasKey: !!getAPIKey(serviceName, providerId) })
  }
  const openRouter = AI_PROVIDERS['openrouter']
  if (openRouter) result.push({ provider: openRouter, hasKey: !!getAPIKey(serviceName, 'openrouter') })
  const ollama = AI_PROVIDERS['ollama']
  if (ollama) result.push({ provider: ollama, hasKey: true })
  return result
}

// ===== ModelSwitcher =====
export function ModelSwitcher({
  serviceName = 'agent',
  storagePrefix = 'arqon-agent',
  onModelChange,
  className = '',
  compact = false,
}: {
  serviceName?: string
  storagePrefix?: string
  onModelChange?: (provider: string, model: string, apiKey: string) => void
  className?: string
  compact?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<{ provider: AIProvider; hasKey: boolean }[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [selectedProvider, setSelectedProvider] = useState(() => {
    return localStorage.getItem(`${storagePrefix}-provider`) || 'google'
  })
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem(`${storagePrefix}-model`) || 'google/gemini-3-flash-preview'
  })

  const updateDropdownPos = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.top, left: rect.left })
    }
  }, [])

  useEffect(() => {
    if (isOpen) updateDropdownPos()
  }, [isOpen, updateDropdownPos])

  useEffect(() => {
    setAvailableProviders(getAvailableProviders(serviceName))
  }, [serviceName])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (dropdownRef.current && !dropdownRef.current.contains(target) && triggerRef.current && !triggerRef.current.contains(target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (providerId: string, modelId: string) => {
    setSelectedProvider(providerId)
    setSelectedModel(modelId)
    localStorage.setItem(`${storagePrefix}-provider`, providerId)
    localStorage.setItem(`${storagePrefix}-model`, modelId)
    setIsOpen(false)
    const apiKey = getAPIKey(serviceName, providerId) || ''
    onModelChange?.(providerId, modelId, apiKey)
  }

  const currentProvider = AI_PROVIDERS[selectedProvider]
  const currentModels = getModelsForProvider(selectedProvider)
  const currentModel = currentModels.find(m => m.id === selectedModel) || currentModels[0]
  const hasCurrentKey = !!getAPIKey(serviceName, selectedProvider) || currentProvider?.supportsLocalMode

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium border ${
          !hasCurrentKey ? 'border-amber-500/50' : 'border-gray-300 dark:border-gray-700'
        } bg-white dark:bg-[#1f2937] text-gray-800 dark:text-white hover:border-cyan-400 dark:hover:border-cyan-500 ${compact ? 'px-2 py-1.5 text-xs' : ''}`}
      >
        <Cpu size={compact ? 14 : 16} className="text-cyan-500" />
        <span className="max-w-[150px] truncate">
          {selectedProvider ? (currentModel?.name || 'Select Model') : 'Configure API Key'}
        </span>
        {!hasCurrentKey && <AlertCircle size={14} className="text-amber-500" />}
        <ChevronDown size={compact ? 14 : 16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            bottom: `${window.innerHeight - dropdownPos.top + 8}px`,
            left: `${dropdownPos.left}px`,
            zIndex: 9999,
            width: '400px',
            maxWidth: `calc(100vw - 16px)`,
            maxHeight: `${Math.min(500, dropdownPos.top - 16)}px`,
          }}
          className="overflow-hidden rounded-xl shadow-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#00d4ff]/30"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-[#374151] bg-gray-50 dark:bg-[#1f2937]/50">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-cyan-500" />
              <span className="text-gray-900 dark:text-white font-semibold">Select Model</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {FRONTIER_PROVIDERS.some(p => getAPIKey(serviceName, p))
                ? 'Using Frontier API'
                : getAPIKey(serviceName, 'openrouter')
                  ? 'Using OpenRouter'
                  : 'No API key configured — using server-side Gemini'}
            </p>
          </div>

          <div className="overflow-y-auto max-h-[400px]">
            {availableProviders.map(({ provider, hasKey }) => {
              const models = getModelsForProvider(provider.id)
              const isExpanded = selectedProvider === provider.id
              return (
                <div key={provider.id} className="border-b border-gray-100 dark:border-[#374151]/50 last:border-0">
                  <button
                    onClick={() => {
                      if (hasKey || provider.supportsLocalMode) {
                        if (selectedProvider !== provider.id && models.length > 0) {
                          handleSelect(provider.id, models[0].id)
                        }
                      }
                    }}
                    disabled={!hasKey && !provider.supportsLocalMode}
                    className={`w-full px-4 py-3 flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-[#1f2937]/50 ${!hasKey && !provider.supportsLocalMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: provider.color + '20' }}>
                        <Cpu size={16} style={{ color: provider.color }} />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{provider.name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{models.length} models available</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasKey || provider.supportsLocalMode ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                          <Key size={10} className="inline mr-1" />
                          {provider.supportsLocalMode ? 'Local' : 'Ready'}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">No Key</span>
                      )}
                      {isExpanded && (hasKey || provider.supportsLocalMode) && <Check size={16} className="text-cyan-500" />}
                    </div>
                  </button>

                  {isExpanded && (hasKey || provider.supportsLocalMode) && (
                    <div className="px-2 pb-2">
                      <div className="rounded-lg p-2 max-h-[300px] overflow-y-auto bg-gray-50 dark:bg-[#0a0e1a]">
                        {models.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => handleSelect(provider.id, model.id)}
                            className={`w-full px-3 py-2 rounded-md text-left transition-colors flex items-center justify-between hover:bg-white dark:hover:bg-[#1f2937] ${
                              selectedModel === model.id ? 'bg-cyan-50 dark:bg-[#00d4ff]/10 border border-cyan-300 dark:border-[#00d4ff]/30' : ''
                            }`}
                          >
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</div>
                              {model.description && <div className="text-gray-500 dark:text-gray-400 text-xs truncate max-w-[280px]">{model.description}</div>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {model.isFree && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">Free</span>}
                              {selectedModel === model.id && <Check size={14} className="text-cyan-500" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ===== AgentInput (modern textarea with model selector) =====
export function AgentInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading = false,
  placeholder = 'Message Gemini... (try: show templates, use slack, compose, deploy)',
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop?: () => void
  isLoading?: boolean
  placeholder?: string
  selectedProvider: string
  selectedModel: string
  onProviderChange: (provider: string) => void
  onModelChange: (model: string) => void
}) {
  const [showModelSelector, setShowModelSelector] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelSelectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setShowModelSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !isLoading) onSend()
    }
  }

  const models = getModelsForProvider(selectedProvider)
  const currentModel = models.find(m => m.id === selectedModel) || models[0]
  const getDisplayModelName = () => {
    if (currentModel?.name) return currentModel.name.length > 20 ? currentModel.name.slice(0, 18) + '...' : currentModel.name
    return selectedModel.split('/').pop() || 'Select model'
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <div className="relative">
        <div className="flex flex-col bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm dark:shadow-none focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors duration-200">
          <div className="flex items-end gap-2 p-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="flex-1 resize-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-base max-h-[200px] py-2"
              disabled={isLoading}
            />
            {isLoading && onStop ? (
              <button onClick={onStop} className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all duration-200" title="Stop generation">
                <Square size={20} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!value.trim() || isLoading}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  value.trim() && !isLoading
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send size={20} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-3 pb-2">
            <div className="relative" ref={modelSelectorRef}>
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              >
                <Cpu size={12} />
                <span>{getDisplayModelName()}</span>
                <ChevronDown size={12} className={`transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
              </button>

              {showModelSelector && (
                <div className="absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50">
                  <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700">
                    {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                      <button
                        key={key}
                        onClick={() => {
                          onProviderChange(key)
                          const providerModels = getModelsForProvider(key)
                          if (providerModels.length > 0 && providerModels[0]) onModelChange(providerModels[0].id)
                        }}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                          selectedProvider === key
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {provider.name}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 space-y-1">
                    {models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => { onModelChange(model.id); setShowModelSelector(false) }}
                        className={`w-full flex flex-col items-start px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                          selectedModel === model.id ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</span>
                        {model.description && <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{model.description}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  )
}
