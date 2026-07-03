import { useState } from 'react'
import { Terminal, Server } from 'lucide-react'
import { ServiceTitle, UTCClock, ServiceSwitcher, NavPageButton } from './ArqonNav'

interface HeaderProps {
  page: 'composer' | 'mcp'
  onNavigate: (page: 'composer' | 'mcp') => void
}

export function Header({ page, onNavigate }: HeaderProps) {
  const [showServiceSwitcher, setShowServiceSwitcher] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-50 bg-white dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-800 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-2 h-[56px]">
          {/* Left: Service Title (clickable to open switcher) + Nav */}
          <div className="flex items-center gap-6">
            <ServiceTitle
              serviceName="agent"
              faviconUrl="/favicon.png"
              onClick={() => setShowServiceSwitcher(true)}
            />
            <nav className="hidden md:flex items-center gap-2">
              <NavPageButton
                active={page === 'composer'}
                onClick={() => onNavigate('composer')}
                icon={<Terminal className="w-4 h-4" />}
                label="Composer"
              />
              <NavPageButton
                active={page === 'mcp'}
                onClick={() => onNavigate('mcp')}
                icon={<Server className="w-4 h-4" />}
                label="MCP"
              />
            </nav>
          </div>

          {/* Center: UTC Clock */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
            <UTCClock className="text-sm text-gray-500 dark:text-gray-400" />
          </div>

          {/* Right: Mobile nav (simplified) */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => onNavigate('composer')}
              className={`p-2 rounded ${page === 'composer' ? 'bg-[#07112e] text-white' : 'text-[#07112e]'}`}
            >
              <Terminal className="w-5 h-5" />
            </button>
            <button
              onClick={() => onNavigate('mcp')}
              className={`p-2 rounded ${page === 'mcp' ? 'bg-[#07112e] text-white' : 'text-[#07112e]'}`}
            >
              <Server className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile UTC Clock */}
        <div className="md:hidden flex justify-center pb-2">
          <UTCClock className="text-sm text-gray-500" />
        </div>
      </header>

      {/* Service Switcher Modal */}
      <ServiceSwitcher
        isOpen={showServiceSwitcher}
        onClose={() => setShowServiceSwitcher(false)}
        currentService="AGENT"
      />
    </>
  )
}
