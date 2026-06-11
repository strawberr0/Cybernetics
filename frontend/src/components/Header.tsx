import { Bot, Gitlab, Server, Terminal } from 'lucide-react'

interface HeaderProps {
  page: 'composer' | 'mcp'
  onNavigate: (page: 'composer' | 'mcp') => void
}

export function Header({ page, onNavigate }: HeaderProps) {
  return (
    <header className="retro-chrome border-b-2 border-[#6e6a63]">
      <div className="h-[76px] px-6 flex items-center justify-between">
        <div className="flex items-center gap-8 h-full">
          <div className="flex items-center gap-4 pr-8 h-full border-r border-[#9b958c]">
            <Bot className="w-10 h-10 text-[#061a7a]" strokeWidth={2.25} />
            <h1 className="text-3xl font-black tracking-tight text-[#07112e]">Cybernetics</h1>
          </div>
          <nav className="hidden md:flex items-center gap-3">
            <button
              onClick={() => onNavigate('composer')}
              className={`retro-button flex items-center gap-3 px-5 py-3 text-xl font-bold ${
                page === 'composer' ? 'retro-button-active' : ''
              }`}
            >
              <Terminal className="w-6 h-6 text-[#4cff3f]" />
              Composer
            </button>
            <button
              onClick={() => onNavigate('mcp')}
              className={`retro-button flex items-center gap-3 px-5 py-3 text-xl font-bold ${
                page === 'mcp' ? 'retro-button-active' : ''
              }`}
            >
              <Server className="w-6 h-6" />
              MCP
            </button>
          </nav>
        </div>
        <a
          href="https://gitlab.com/strawberryfield/cybernetics"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-lg font-bold text-[#071a7a] underline decoration-2 underline-offset-4 hover:text-[#0b2db3]"
        >
          <Gitlab className="w-8 h-8 text-[#fc6d26]" />
          <span className="hidden sm:inline">GitLab</span>
        </a>
      </div>
    </header>
  )
}
