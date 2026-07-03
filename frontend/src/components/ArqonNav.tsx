import { useState, useEffect } from 'react'
import { Clock, X } from 'lucide-react'

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
