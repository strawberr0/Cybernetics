import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Terminal, Cpu, Check, Copy, Cloud, LayoutTemplate, Sparkles, Plug, Rocket, ChevronDown, X, Server } from 'lucide-react'

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
      <div className="text-sm text-slate-200 whitespace-pre-wrap">
        {lines.map((line, i) => {
          if (line.startsWith('```')) return null
          if (line.startsWith('**') && line.endsWith('**')) {
            return <div key={i} className="font-semibold text-white">{line.slice(2, -2)}</div>
          }
          if (line.startsWith('• ')) {
            return <div key={i} className="text-slate-400 pl-2">{line}</div>
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

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-h-[800px] rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
        <Terminal className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-white">Agent Composer</span>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setActivePanel(activePanel === 'templates' ? null : 'templates')}
            title="Templates"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${activePanel === 'templates' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Templates</span>
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'adapters' ? null : 'adapters')}
            title="MCP Adapters"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${activePanel === 'adapters' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Server className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Adapters</span>
          </button>

          {/* AI Keys Dropdown */}
          <div className="relative" ref={aiDropdownRef}>
            <button
              onClick={() => setAiDropdownOpen(v => !v)}
              title="AI Provider Keys"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${aiDropdownOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Keys</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {aiDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 p-3 rounded-lg bg-slate-900 border border-slate-700 shadow-xl z-50">
                <label className="text-xs text-slate-400 block mb-1">GEMINI_API_KEY</label>
                <input
                  type="text"
                  value={geminiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGeminiKey(e.target.value)}
                  placeholder="Enter Gemini API key"
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
                <p className="text-[10px] text-slate-500 mt-1">Used for /api/chat and /api/compose endpoints</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setActivePanel(activePanel === 'keys' ? null : 'keys')}
            title="Service Keys"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${activePanel === 'keys' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Plug className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keys</span>
            {getRequiredKeys().length > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[9px] flex items-center justify-center">{getRequiredKeys().length}</span>
            )}
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'deploy' ? null : 'deploy')}
            title="Deploy"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${activePanel === 'deploy' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deploy</span>
          </button>
        </div>
      </div>

      {/* Inline Panels */}
      {renderPanel()}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && msg.role !== 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                <Cpu className="w-4 h-4 text-slate-400" />
              </div>
            )}
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-transparent text-white' : 'bg-slate-900 text-slate-200'} rounded-xl px-4 py-3`}>
              {renderMessage(msg)}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="bg-slate-900 rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-900">
        <div className="flex gap-2 items-center">
          <select
            value={selectedModel}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedModel(e.target.value)}
            title="Select Gemini model"
            className="px-2 py-2.5 bg-slate-950 rounded-lg text-xs text-slate-300 focus:outline-none max-w-[180px] shrink-0"
          >
            {Object.entries(modelOptions).map(([label, id]) => (
              <option key={id} value={id} className="bg-slate-900 text-slate-300">Gemini {label}</option>
            ))}
          </select>
          <input
            type="text"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
            placeholder="Message Gemini... (try: show templates, use slack, compose, deploy)"
            className="flex-1 px-4 py-2.5 bg-slate-950 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
