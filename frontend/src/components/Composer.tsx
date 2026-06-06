import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Terminal, Cpu, Check, Copy, Cloud, LayoutTemplate, Sparkles, Plug, Rocket, ChevronDown, X, Server, Menu, Settings, Plus, Search, Info, Code2 } from 'lucide-react'

interface Template {
  name: string
  description: string
  adapters: string[]
  phases: string[]
}

interface Adapter {
  name: string
  description: string
  source: string
  group?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  action?: string
  actionData?: any
  timestamp: Date
}

const envMap: Record<string, string[]> = {
  // ── Secret keys only (connection URLs are preset by ops) ──
  airtable: ['AIRTABLE_API_KEY'],
  arize: ['ARIZE_API_KEY'],
  asana: ['ASANA_TOKEN'],
  aws: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
  brave: [],
  browser: [],
  chrome: [],
  cloudflare: ['CLOUDFLARE_API_TOKEN'],
  confluence: ['CONFLUENCE_API_TOKEN'],
  datadog: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
  docker: [],
  dynatrace: ['DYNATRACE_API_TOKEN'],
  elastic: ['ELASTIC_API_KEY'],
  fivetran: ['FIVETRAN_API_KEY', 'FIVETRAN_API_SECRET'],
  firefox: [],
  github: ['GITHUB_TOKEN'],
  gitlab: ['GITLAB_TOKEN'],
  'google-alloydb': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-analytics': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-bigtable': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-chronicle': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-cloud-resource-manager': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-cloud-run': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-cloud-sql-mysql': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-cloud-sql-postgres': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-cloud-sql-sqlserver': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-cloud-storage': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-compute-engine': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-developer-knowledge': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-firebase': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-firestore': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-flutter': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-gcloud': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-genmedia': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-gke': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-go': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-maps': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-mcp-toolbox': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-observability': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-spanner': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  'google-workspace': ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  jira: ['JIRA_API_TOKEN'],
  kubernetes: ['KUBECONFIG'],
  linear: ['LINEAR_API_KEY'],
  mongodb: ['MONGODB_URI'],
  n8n: ['N8N_API_KEY'],
  notion: ['NOTION_TOKEN'],
  pagerduty: ['PAGERDUTY_API_KEY'],
  postgres: [],
  quickbooks: ['QUICKBOOKS_ACCESS_TOKEN', 'QUICKBOOKS_COMPANY_ID'],
  redis: ['REDIS_URL'],
  shopify: ['SHOPIFY_ACCESS_TOKEN', 'SHOPIFY_SHOP_DOMAIN'],
  slack: ['SLACK_BOT_TOKEN'],
  snowflake: ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD'],
  stripe: ['STRIPE_API_KEY'],
  supabase: ['SUPABASE_KEY'],
  vercel: ['VERCEL_TOKEN'],
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

export function Composer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: 'system',
      content: 'Welcome to Cybernetics Composer. Type a message to chat with Gemini, or try:\n• "show templates" — browse agent templates\n• "use datadog and slack" — pick adapters\n• "set DATADOG_API_KEY=xxx" — configure keys\n• "compose" — generate agent code\n• "deploy to us-central1" — deploy to Cloud Run',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [welcomeOpen, setWelcomeOpen] = useState(true)
  const [sessionHistoryOpen, setSessionHistoryOpen] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [allAdapters, setAllAdapters] = useState<Adapter[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedAdapters, setSelectedAdapters] = useState<Set<string>>(new Set())
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [agentCode, setAgentCode] = useState('')
  const [activePanel, setActivePanel] = useState<'templates' | 'adapters' | 'keys' | 'deploy' | null>(null)
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false)
  const [geminiKey, setGeminiKey] = useState('')
  const modelOptions: Record<string, string> = {
    '3 Flash': 'gemini-3-flash-preview',
    '3 Pro': 'gemini-3-pro-preview',
    '3.1 Flash Lite': 'gemini-3.1-flash-lite',
    '3.1 Pro': 'gemini-3.1-pro-preview',
    '3.5 Flash': 'gemini-3.5-flash',
  }
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview')
  const scrollRef = useRef<HTMLDivElement>(null)
  const aiDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then((data: { templates: Template[]; adapters: Adapter[] }) => {
        setTemplates(data.templates)
        setAllAdapters(data.adapters)
      })
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) {
        setAiDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addMessage = useCallback((msg: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: generateId(), timestamp: new Date() }])
  }, [])

  function getRequiredKeys() {
    const keys: string[] = []
    selectedAdapters.forEach((a: string) => {
      keys.push(...(envMap[a] || []))
    })
    return [...new Set(keys)]
  }

  function groupAdapters(items: Adapter[]) {
    const grouped = new Map<string, Adapter[]>()
    const ungrouped: Adapter[] = []
    for (const a of items) {
      if (a.group) {
        if (!grouped.has(a.group)) grouped.set(a.group, [])
        grouped.get(a.group)!.push(a)
      } else {
        ungrouped.push(a)
      }
    }
    return { grouped, ungrouped }
  }

  function renderAdapterCard(a: Adapter) {
    return (
      <button
        key={a.name}
        onClick={() => {
          setSelectedAdapters(prev => {
            const next = new Set(prev)
            if (next.has(a.name)) next.delete(a.name)
            else next.add(a.name)
            return next
          })
        }}
        className={`text-left p-3 rounded-lg border transition-all ${
          selectedAdapters.has(a.name)
            ? 'border-emerald-500/50 bg-emerald-500/10'
            : 'border-slate-800 bg-slate-950 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold text-white capitalize">{a.name}</div>
          {selectedAdapters.has(a.name) && <Check className="w-3 h-3 text-emerald-400" />}
        </div>
        <div className="text-xs text-slate-400">{a.description}</div>
        {a.source && (
          <a
            href={a.source}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
            className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 inline-block"
          >
            Source ↗
          </a>
        )}
      </button>
    )
  }

  function renderAdapterGrid(items: Adapter[]) {
    const { grouped, ungrouped } = groupAdapters(items)
    // Flatten grouped adapters so they render as individual cards like everything else
    const allItems = [...ungrouped]
    for (const [, groupItems] of grouped) {
      allItems.push(...groupItems)
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
        {allItems.map(a => renderAdapterCard(a))}
      </div>
    )
  }

  async function handleChat(text: string, currentMessages: Message[]) {
    setIsTyping(true)
    try {
      const history = currentMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          model: selectedModel,
          gemini_key: geminiKey,
          context: {
            template: selectedTemplate?.name || '',
            adapters: Array.from(selectedAdapters),
            env_vars: envVars,
          },
        }),
      })

      if (!r.ok) {
        const err = await r.text()
        addMessage({ role: 'assistant', content: `Error: ${err}` })
        return
      }

      const data = await r.json()
      addMessage({
        role: 'assistant',
        content: data.reply || '...',
        action: data.action,
        actionData: data.action_data,
      })

      // Handle actions
      switch (data.action) {
        case 'show_templates':
          addMessage({
            role: 'system',
            content: 'templates',
            action: 'templates',
            actionData: templates,
          })
          break
        case 'show_adapters':
          addMessage({
            role: 'system',
            content: 'adapters',
            action: 'adapters',
            actionData: allAdapters,
          })
          break
        case 'show_keys':
          addMessage({
            role: 'system',
            content: 'keys',
            action: 'keys',
            actionData: getRequiredKeys(),
          })
          break
        case 'show_deploy':
          addMessage({
            role: 'system',
            content: 'deploy',
            action: 'deploy',
          })
          break
        case 'compose':
          await handleCompose()
          break
      }
    } catch (err: any) {
      addMessage({ role: 'assistant', content: `Network error: ${err.message}` })
    } finally {
      setIsTyping(false)
    }
  }

  async function handleCompose(customPrompt?: string) {
    setIsTyping(true)
    try {
      const r = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: selectedTemplate?.name || 'custom',
          adapters: Array.from(selectedAdapters),
          env_vars: envVars,
          prompt: customPrompt || '',
        }),
      })
      const data = await r.json()
      setAgentCode(data.agent_code)
      addMessage({
        role: 'system',
        content: 'Agent composed successfully.',
        action: 'composed',
        actionData: { code: data.agent_code, dockerfile: data.dockerfile },
      })
    } catch (err: any) {
      addMessage({ role: 'assistant', content: `Compose failed: ${err.message}` })
    } finally {
      setIsTyping(false)
    }
  }

  async function handleDeploy(projectId: string, region: string, serviceName: string) {
    setIsTyping(true)
    try {
      const r = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          region,
          service_name: serviceName || `cybernetics-${selectedTemplate?.name || 'agent'}`,
          agent_code: agentCode,
        }),
      })
      const data = await r.json()
      addMessage({
        role: 'assistant',
        content: `${data.message}\n\n**Command:**\n\`\`\`bash\n${data.command}\n\`\`\``,
      })
    } catch (err: any) {
      addMessage({ role: 'assistant', content: `Deploy failed: ${err.message}` })
    } finally {
      setIsTyping(false)
    }
  }

  function handleSend() {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    setWelcomeOpen(false)

    // Local command shortcuts
    if (text.toLowerCase() === 'show templates' || text.toLowerCase() === 'templates') {
      addMessage({ role: 'user', content: text })
      addMessage({ role: 'system', content: 'templates', action: 'templates', actionData: templates })
      return
    }
    if (text.toLowerCase() === 'show adapters' || text.toLowerCase() === 'adapters') {
      addMessage({ role: 'user', content: text })
      addMessage({ role: 'system', content: 'adapters', action: 'adapters', actionData: allAdapters })
      return
    }
    if (text.toLowerCase() === 'show keys' || text.toLowerCase() === 'keys') {
      addMessage({ role: 'user', content: text })
      addMessage({ role: 'system', content: 'keys', action: 'keys', actionData: getRequiredKeys() })
      return
    }
    if (text.toLowerCase() === 'compose') {
      addMessage({ role: 'user', content: text })
      handleCompose().catch(err => {
        addMessage({ role: 'assistant', content: `Compose failed: ${err.message}` })
      })
      return
    }
    if (text.toLowerCase().startsWith('deploy')) {
      addMessage({ role: 'user', content: text })
      addMessage({ role: 'system', content: 'deploy', action: 'deploy' })
      return
    }
    // Key setting: "set KEY=value"
    const keyMatch = text.match(/^set\s+(\w+)=(.+)$/i)
    if (keyMatch) {
      const [, key, value] = keyMatch
      setEnvVars(prev => ({ ...prev, [key]: value }))
      addMessage({ role: 'user', content: text })
      addMessage({ role: 'assistant', content: `Set \`${key}\` = \`***\`` })
      return
    }
    // Adapter toggle: "use datadog, slack"
    const useMatch = text.match(/^use\s+(.+)$/i)
    if (useMatch) {
      const names = useMatch[1].split(/,\s*/).map(s => s.trim().toLowerCase())
      const valid = names.filter(n => allAdapters.some(a => a.name === n))
      setSelectedAdapters(prev => {
        const next = new Set(prev)
        valid.forEach(v => next.add(v))
        return next
      })
      addMessage({ role: 'user', content: text })
      addMessage({
        role: 'assistant',
        content: `Selected adapters: ${valid.join(', ') || 'none'}`,
      })
      return
    }

    addMessage({ role: 'user', content: text })
    handleChat(text, messages)
  }

  function selectTemplate(t: Template) {
    setSelectedTemplate(t)
    setSelectedAdapters(new Set(t.adapters))
    addMessage({
      role: 'assistant',
      content: `Selected template: **${t.name}**. Default adapters loaded: ${t.adapters.join(', ')}.`,
    })
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    addMessage({ role: 'system', content: 'Copied to clipboard.' })
  }

  function renderMessage(msg: Message) {
    if (msg.action === 'templates') {
      const items: Template[] = msg.actionData || templates
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          {items.map((t: Template) => (
            <button
              key={t.name}
              onClick={() => selectTemplate(t)}
              className={`text-left p-3 rounded-lg border transition-all ${
                selectedTemplate?.name === t.name
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold text-white capitalize">{t.name}</div>
              <div className="text-xs text-slate-400">{t.description}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {t.adapters.map((a: string) => (
                  <span key={a} className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300">{a}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )
    }

    if (msg.action === 'adapters') {
      const items: Adapter[] = msg.actionData || allAdapters
      return renderAdapterGrid(items)
    }

    if (msg.action === 'keys') {
      const keys: string[] = msg.actionData || getRequiredKeys()
      if (keys.length === 0) {
        return <div className="text-slate-500 text-sm mt-2">No keys required for selected adapters.</div>
      }
      return (
        <div className="space-y-2 mt-2">
          {keys.map((key: string) => (
            <div key={key} className="flex gap-2">
              <span className="text-xs text-slate-400 w-32 shrink-0 pt-1.5">{key}</span>
              <input
                type="text"
                value={envVars[key] || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEnvVars(prev => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={`Enter ${key}`}
                className="flex-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          ))}
        </div>
      )
    }

    if (msg.action === 'composed' && msg.actionData) {
      const { code, dockerfile: df } = msg.actionData
      return (
        <div className="space-y-2 mt-2">
          <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
              <span className="text-xs font-medium text-slate-300">agent.py</span>
              <button onClick={() => copyCode(code)} className="text-slate-500 hover:text-emerald-400">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <pre className="p-3 text-[11px] text-slate-300 overflow-x-auto max-h-64 overflow-y-auto">
              <code>{code}</code>
            </pre>
          </div>
          {df && (
            <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs font-medium text-slate-300">Dockerfile</div>
              <pre className="p-3 text-[11px] text-slate-300 overflow-x-auto">{df}</pre>
            </div>
          )}
        </div>
      )
    }

    if (msg.action === 'deploy') {
      return (
        <div className="space-y-2 mt-2 p-3 rounded-lg bg-slate-900 border border-slate-800">
          <div className="grid grid-cols-1 gap-2">
            <input
              type="text"
              placeholder="GCP Project ID"
              className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  const inputs = (e.currentTarget.parentElement?.querySelectorAll('input') as NodeListOf<HTMLInputElement>)
                  handleDeploy(inputs[0].value, inputs[1].value || 'us-central1', inputs[2].value)
                }
              }}
            />
            <input
              type="text"
              placeholder="Region (default: us-central1)"
              defaultValue="us-central1"
              className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
            />
            <input
              type="text"
              placeholder="Service name"
              className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              const inputs = (e.currentTarget.parentElement?.querySelectorAll('input') as NodeListOf<HTMLInputElement>)
              handleDeploy(inputs[0].value, inputs[1].value || 'us-central1', inputs[2].value)
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
          >
            <Cloud className="w-3 h-3" /> Deploy
          </button>
        </div>
      )
    }

    // Regular markdown-ish text
    const lines = msg.content.split('\n')
    return (
      <div className={`text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'text-white' : 'text-[#080b12]'}`}>
        {lines.map((line, i) => {
          if (line.startsWith('```')) return null
          if (line.startsWith('**') && line.endsWith('**')) {
            return <div key={i} className="font-semibold">{line.slice(2, -2)}</div>
          }
          if (line.startsWith('• ')) {
            return <div key={i} className="pl-2 opacity-80">{line}</div>
          }
          return <div key={i}>{line}</div>
        })}
      </div>
    )
  }

  function renderPanel() {
    if (activePanel === 'templates') {
      return (
        <div className="p-4 border-b border-slate-800 bg-slate-900 space-y-3 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><LayoutTemplate className="w-4 h-4 text-emerald-400" /> Select Template</h3>
            <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
            {templates.map((t: Template) => (
              <button
                key={t.name}
                onClick={() => { selectTemplate(t); setActivePanel(null) }}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedTemplate?.name === t.name
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-white capitalize">{t.name}</div>
                <div className="text-xs text-slate-400">{t.description}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {t.adapters.map((a: string) => (
                    <span key={a} className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300">{a}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (activePanel === 'adapters') {
      return (
        <div className="p-4 border-b border-slate-800 bg-slate-900 space-y-3 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Plug className="w-4 h-4 text-blue-400" /> MCP Adapters</h3>
            <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin pr-1">
            {renderAdapterGrid(allAdapters)}
          </div>
        </div>
      )
    }

    if (activePanel === 'keys') {
      const keys = getRequiredKeys()
      return (
        <div className="p-4 border-b border-slate-800 bg-slate-900 space-y-3 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Plug className="w-4 h-4 text-blue-400" /> Service Keys</h3>
            <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          {keys.length === 0 ? (
            <p className="text-xs text-slate-500">No keys required for selected adapters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
              {keys.map((key: string) => (
                <div key={key} className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 w-40 shrink-0">{key}</span>
                  <input
                    type="text"
                    value={envVars[key] || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnvVars(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Enter ${key}`}
                    className="flex-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (activePanel === 'deploy') {
      return (
        <div className="p-4 border-b border-slate-800 bg-slate-900 space-y-3 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Rocket className="w-4 h-4 text-rose-400" /> Deploy</h3>
            <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input type="text" id="deploy-project" placeholder="GCP Project ID" className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50" />
            <input type="text" id="deploy-region" defaultValue="us-central1" placeholder="Region" className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50" />
            <input type="text" id="deploy-service" placeholder="Service name" className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50" />
          </div>
          <button
            onClick={() => {
              const p = (document.getElementById('deploy-project') as HTMLInputElement)?.value || ''
              const r = (document.getElementById('deploy-region') as HTMLInputElement)?.value || 'us-central1'
              const s = (document.getElementById('deploy-service') as HTMLInputElement)?.value || ''
              setActivePanel(null)
              handleDeploy(p, r, s)
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
          >
            <Cloud className="w-3 h-3" /> Deploy to Cloud Run
          </button>
        </div>
      )
    }

    return null
  }

  const selectedModelLabel = Object.entries(modelOptions).find(([, id]) => id === selectedModel)?.[0] || '3 Flash'
  const hasConversation = messages.some(msg => msg.role === 'user' || msg.role === 'assistant')
  const showWelcome = welcomeOpen && !hasConversation
  const blueprintState = isTyping ? 'thinking' : hasConversation ? 'conversation' : input.trim() ? 'drafting' : 'idle'

  return (
    <div className="retro-window h-[calc(100vh-76px)] min-h-[680px] overflow-hidden">
      <div className="flex h-full">
        <aside className="hidden lg:flex w-[78px] flex-col items-center border-r-2 border-[#706b63] bg-[#d6d2cb]">
          <button
            className={`retro-icon-button mt-4 ${sessionHistoryOpen ? 'bg-[#09217f] text-white' : 'text-[#0a1880]'}`}
            title={sessionHistoryOpen ? 'Collapse session history' : 'Expand session history'}
            onClick={() => setSessionHistoryOpen(open => !open)}
            aria-pressed={sessionHistoryOpen}
          >
            <Menu className="w-8 h-8" />
          </button>
          <button className="retro-icon-button mt-3 text-[#0a1880]" title="Settings">
            <Settings className="w-7 h-7" />
          </button>
          <button
            className="mt-auto mb-20 text-3xl font-black"
            title={sessionHistoryOpen ? 'Collapse session history' : 'Expand session history'}
            onClick={() => setSessionHistoryOpen(open => !open)}
          >
            {sessionHistoryOpen ? '«' : '»'}
          </button>
        </aside>

        {sessionHistoryOpen && (
        <aside className="hidden xl:block w-[324px] border-r-2 border-[#706b63] bg-[#d8d4cd] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black tracking-wide">SESSION HISTORY</h2>
            <button className="retro-button flex items-center gap-2 px-3 py-2 text-sm font-bold">
              <Plus className="w-4 h-4 text-[#071a7a]" /> New Session
            </button>
          </div>
          <label className="mt-6 flex items-center gap-3 border-2 border-[#7d776d] bg-[#eeeae4] px-3 py-3 shadow-inner">
            <Search className="w-6 h-6" />
            <input className="w-full bg-transparent text-lg outline-none placeholder:text-[#4d4a47]" placeholder="Search sessions..." />
          </label>

          <div className="mt-7 space-y-5 text-sm">
            <div>
              <h3 className="mb-3 font-black">TODAY</h3>
              <button className="w-full bg-[#09217f] p-4 text-left text-white shadow-[inset_0_0_0_1px_#1e4bd7]">
                <div className="flex items-center gap-2 font-bold">
                  <Terminal className="w-4 h-4 text-[#62ff39]" />
                  Incident response agent
                  <span className="ml-auto h-3 w-3 border border-[#2c2a26] bg-[#62ff39]" />
                </div>
                <div className="ml-6 mt-1">Datadog · Slack · 2m ago</div>
              </button>
              <button className="w-full border-b border-[#8b857b] p-4 text-left">
                <div className="flex items-center font-bold">Slack alert summarizer<span className="ml-auto h-3 w-3 border border-[#2c2a26] bg-[#ffd31f]" /></div>
                <div className="mt-1">Datadog · Slack · 45m ago</div>
              </button>
            </div>
            <div>
              <h3 className="mb-3 font-black">YESTERDAY</h3>
              {[
                ['GitHub PR reviewer', 'GitHub · OpenAI · 1d ago', '#b9b7b2'],
                ['Cloud Run deploy bot', 'Cloud Run · GCP · 1d ago', '#39e94c'],
              ].map(([title, meta, color]) => (
                <button key={title} className="w-full border-b border-[#8b857b] p-4 text-left">
                  <div className="flex items-center font-bold">{title}<span className="ml-auto h-3 w-3 border border-[#2c2a26]" style={{ backgroundColor: color }} /></div>
                  <div className="mt-1">{meta}</div>
                </button>
              ))}
            </div>
            <div>
              <h3 className="mb-3 font-black">PREVIOUS 7 DAYS</h3>
              {[
                ['On-call escalation bot', 'PagerDuty · Slack · 3d ago', '#ff2438'],
                ['Data pipeline monitor', 'BigQuery · Slack · 5d ago', '#ffd31f'],
              ].map(([title, meta, color]) => (
                <button key={title} className="w-full border-b border-[#8b857b] p-4 text-left">
                  <div className="flex items-center font-bold">{title}<span className="ml-auto h-3 w-3 border border-[#2c2a26]" style={{ backgroundColor: color }} /></div>
                  <div className="mt-1">{meta}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="composer-toolbar flex min-h-[72px] items-center gap-4 border-b-2 border-[#676057] bg-[#09217f] px-6 text-white">
            <Terminal className="w-8 h-8 text-[#58ff3e]" />
            <span className="composer-title text-2xl font-black tracking-wide">Agent Composer</span>
            <div className="composer-toolbar-actions ml-auto flex items-center gap-2">
              <button onClick={() => setActivePanel(activePanel === 'templates' ? null : 'templates')} className="retro-button toolbar-button"><LayoutTemplate className="w-6 h-6 text-[#071a7a]" />Templates</button>
              <button onClick={() => setActivePanel(activePanel === 'adapters' ? null : 'adapters')} className="retro-button toolbar-button"><Server className="w-6 h-6 text-[#071a7a]" />Adapters</button>
              <div className="relative" ref={aiDropdownRef}>
                <button onClick={() => setAiDropdownOpen(v => !v)} className="retro-button toolbar-button">
                  <Sparkles className="w-6 h-6 text-[#071a7a]" />AI Keys<ChevronDown className="w-5 h-5 text-[#071a7a]" />
                </button>
                {aiDropdownOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 border-2 border-[#1e1b18] bg-[#d8d4cd] p-4 shadow-[4px_4px_0_#111]">
                    <label className="mb-2 block text-sm font-black text-[#07112e]">GEMINI_API_KEY</label>
                    <input
                      type="text"
                      value={geminiKey}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGeminiKey(e.target.value)}
                      placeholder="Enter Gemini API key"
                      className="retro-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
              <button onClick={() => setActivePanel(activePanel === 'keys' ? null : 'keys')} className="retro-button toolbar-button">
                <Plug className="w-6 h-6 text-[#071a7a]" />Keys
                {getRequiredKeys().length > 0 && <span className="ml-1 text-xs">({getRequiredKeys().length})</span>}
              </button>
              <button onClick={() => setActivePanel(activePanel === 'deploy' ? null : 'deploy')} className="retro-button toolbar-button"><Rocket className="w-6 h-6 text-[#071a7a]" />Deploy</button>
            </div>
          </div>

          {renderPanel()}

          <div className="blueprint-grid composer-workspace relative flex flex-1 overflow-hidden p-8">
            <div className={`blueprint-schematic blueprint-schematic-${blueprintState}`} aria-hidden="true">
              <img
                src="/assets/cybernetic-blueprint.png"
                alt=""
                className="blueprint-image"
                draggable={false}
              />
            </div>
            <div ref={scrollRef} className="z-10 flex-1 overflow-y-auto pr-5 scrollbar-thin">
              {showWelcome && (
                <div className="composer-welcome max-w-[680px] border-2 border-[#5d5850] bg-[#dedad3] p-5 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
                  <div className="flex items-start gap-4">
                    <Info className="h-8 w-8 shrink-0 text-[#071a7a]" />
                    <h2 className="text-xl font-black leading-tight">Welcome to Cybernetics Composer.</h2>
                    <button
                      onClick={() => setWelcomeOpen(false)}
                      className="retro-button ml-auto grid h-9 w-9 shrink-0 place-items-center"
                      title="Close welcome message"
                    >
                      <X className="h-5 w-5 text-[#071a7a]" />
                    </button>
                  </div>
                  <div className="my-3 border-t-2 border-dashed border-[#55504a]" />
                  <p className="mb-3 text-base font-bold">Type a message to chat with Gemini, or try:</p>
                  <div className="space-y-2 text-base font-bold">
                    {[
                      ['show templates', 'browse agent templates'],
                      ['use datadog and slack', 'pick adapters'],
                      ['set DATADOG_API_KEY=xxx', 'configure keys'],
                      ['compose', 'generate agent code'],
                      ['deploy to us-central1', 'deploy to Cloud Run'],
                    ].map(([cmd, desc]) => (
                      <div key={cmd} className="flex gap-3">
                        <span className="mt-2 h-3 w-3 bg-[#09217f]" />
                        <span><span className="text-[#071a7a]">{cmd}</span> — {desc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="my-4 border-t-2 border-[#8d877e]" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      onClick={() => {
                        setActivePanel('templates')
                        setWelcomeOpen(false)
                      }}
                      className="retro-button flex items-center justify-center gap-2 px-3 py-3 text-sm font-black"
                    >
                      <LayoutTemplate className="w-6 h-6 text-[#071a7a]" />Browse<br />Templates
                    </button>
                    <button
                      onClick={() => {
                        setActivePanel('adapters')
                        setWelcomeOpen(false)
                      }}
                      className="retro-button flex items-center justify-center gap-2 px-3 py-3 text-sm font-black"
                    >
                      <Plug className="w-6 h-6 text-[#071a7a]" />Connect<br />Adapter
                    </button>
                    <button
                      onClick={() => {
                        setWelcomeOpen(false)
                        handleCompose()
                      }}
                      className="retro-button flex items-center justify-center gap-2 px-3 py-3 text-sm font-black"
                    >
                      <Code2 className="w-6 h-6 text-[#071a7a]" />Compose<br />Agent
                    </button>
                  </div>
                </div>
              )}

              {messages.length > 1 && (
                <div className="mt-5 max-w-[720px] space-y-4">
                  {messages.slice(1).map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role !== 'user' && msg.role !== 'assistant' && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center border-2 border-[#8d877e] bg-[#d8d4cd]">
                          <Cpu className="w-4 h-4 text-[#071a7a]" />
                        </div>
                      )}
                      <div className={`max-w-[85%] border-2 px-4 py-3 shadow-[3px_3px_0_rgba(0,0,0,0.25)] ${msg.role === 'user' ? 'border-[#9fb3ff] bg-[#09217f] text-white' : 'border-[#5d5850] bg-[#dedad3] text-[#080b12]'}`}>
                        {renderMessage(msg)}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="inline-flex gap-1 border-2 border-[#5d5850] bg-[#dedad3] px-4 py-3">
                      <span className="h-2 w-2 animate-bounce bg-[#09217f]" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce bg-[#09217f]" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 animate-bounce bg-[#09217f]" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          <div className="composer-input-bar border-t-2 border-[#706b63] bg-[#d8d4cd] px-6 py-5">
            <div className="composer-input-row flex items-center gap-5">
              <select
                value={selectedModel}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedModel(e.target.value)}
                title="Select Gemini model"
                className="retro-input h-[72px] w-[220px] shrink-0 px-4 text-base font-black"
              >
                {Object.entries(modelOptions).map(([label, id]) => (
                  <option key={id} value={id}>Gemini {label}</option>
                ))}
              </select>
              <input
                type="text"
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
                placeholder={`Message Gemini... (try: show templates, use slack, compose, deploy)`}
                className="retro-input h-[72px] min-w-0 flex-1 px-6 text-lg"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="retro-button flex h-[72px] shrink-0 items-center gap-3 px-8 text-lg font-black disabled:opacity-50"
                title={`Send with Gemini ${selectedModelLabel}`}
              >
                <Send className="w-8 h-8 text-[#071a7a]" />
                Send
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
