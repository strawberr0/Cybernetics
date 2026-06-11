import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Send, Terminal, Cpu, Check, Copy, Cloud, LayoutTemplate, Plug, Rocket, X, Server, Menu, Settings, Plus, Search, Info, Code2, Trash2 } from 'lucide-react'

interface Session {
  id: string
  title: string
  messages: Message[]
  template: string | null
  adapters: string[]
  envVars: Record<string, string>
  createdAt: number
  updatedAt: number
}

const SESSIONS_KEY = 'cybernetics:sessions:v1'
const SETTINGS_KEY = 'cybernetics:settings:v1'

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Session[]
    return parsed.map(s => ({
      ...s,
      messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
    }))
  } catch {
    return []
  }
}

function saveSessions(sessions: Session[]) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)) } catch {}
}

interface Settings {
  geminiKey: string
  defaultModel: string
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { geminiKey: '', defaultModel: 'gemini-3-flash-preview' }
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

function formatRelative(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

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

// Google Cloud Run regions (current as of 2026). Grouped for readable UX.
const CLOUD_RUN_REGIONS: { group: string; regions: { id: string; label: string }[] }[] = [
  { group: 'Africa',        regions: [
    { id: 'africa-south1',         label: 'africa-south1 (Johannesburg)' },
  ]},
  { group: 'Americas',      regions: [
    { id: 'northamerica-northeast1', label: 'northamerica-northeast1 (Montréal)' },
    { id: 'northamerica-northeast2', label: 'northamerica-northeast2 (Toronto)' },
    { id: 'northamerica-south1',     label: 'northamerica-south1 (Mexico)' },
    { id: 'us-central1',           label: 'us-central1 (Iowa)' },
    { id: 'us-east1',              label: 'us-east1 (South Carolina)' },
    { id: 'us-east4',              label: 'us-east4 (N. Virginia)' },
    { id: 'us-east5',              label: 'us-east5 (Columbus)' },
    { id: 'us-south1',             label: 'us-south1 (Dallas)' },
    { id: 'us-west1',              label: 'us-west1 (Oregon)' },
    { id: 'us-west2',              label: 'us-west2 (Los Angeles)' },
    { id: 'us-west3',              label: 'us-west3 (Salt Lake City)' },
    { id: 'us-west4',              label: 'us-west4 (Las Vegas)' },
    { id: 'southamerica-east1',    label: 'southamerica-east1 (São Paulo)' },
    { id: 'southamerica-west1',    label: 'southamerica-west1 (Santiago)' },
  ]},
  { group: 'Europe',        regions: [
    { id: 'europe-central2',       label: 'europe-central2 (Warsaw)' },
    { id: 'europe-north1',         label: 'europe-north1 (Finland)' },
    { id: 'europe-north2',         label: 'europe-north2 (Stockholm)' },
    { id: 'europe-southwest1',     label: 'europe-southwest1 (Madrid)' },
    { id: 'europe-west1',          label: 'europe-west1 (Belgium)' },
    { id: 'europe-west2',          label: 'europe-west2 (London)' },
    { id: 'europe-west3',          label: 'europe-west3 (Frankfurt)' },
    { id: 'europe-west4',          label: 'europe-west4 (Netherlands)' },
    { id: 'europe-west6',          label: 'europe-west6 (Zürich)' },
    { id: 'europe-west8',          label: 'europe-west8 (Milan)' },
    { id: 'europe-west9',          label: 'europe-west9 (Paris)' },
    { id: 'europe-west10',         label: 'europe-west10 (Berlin)' },
    { id: 'europe-west12',         label: 'europe-west12 (Turin)' },
  ]},
  { group: 'Middle East',   regions: [
    { id: 'me-central1',           label: 'me-central1 (Doha)' },
    { id: 'me-central2',           label: 'me-central2 (Dammam)' },
    { id: 'me-west1',              label: 'me-west1 (Tel Aviv)' },
  ]},
  { group: 'Asia Pacific',  regions: [
    { id: 'asia-east1',            label: 'asia-east1 (Taiwan)' },
    { id: 'asia-east2',            label: 'asia-east2 (Hong Kong)' },
    { id: 'asia-northeast1',       label: 'asia-northeast1 (Tokyo)' },
    { id: 'asia-northeast2',       label: 'asia-northeast2 (Osaka)' },
    { id: 'asia-northeast3',       label: 'asia-northeast3 (Seoul)' },
    { id: 'asia-south1',           label: 'asia-south1 (Mumbai)' },
    { id: 'asia-south2',           label: 'asia-south2 (Delhi)' },
    { id: 'asia-southeast1',       label: 'asia-southeast1 (Singapore)' },
    { id: 'asia-southeast2',       label: 'asia-southeast2 (Jakarta)' },
    { id: 'australia-southeast1',  label: 'australia-southeast1 (Sydney)' },
    { id: 'australia-southeast2',  label: 'australia-southeast2 (Melbourne)' },
  ]},
]

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

export function Composer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: 'system',
      content: 'Welcome to Cybernetics Composer. Type a message to chat with Gemini 3, or try:\n• "show templates" — browse agent templates\n• "use gitlab and google-cloud-run" — pick adapters\n• "set GITLAB_TOKEN=xxx" — configure keys\n• "compose" — generate a Gemini-built agent\n• "deploy to us-central1" — ship to Cloud Run',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [welcomeOpen, setWelcomeOpen] = useState(true)
  const [sessionHistoryOpen, setSessionHistoryOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [allAdapters, setAllAdapters] = useState<Adapter[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedAdapters, setSelectedAdapters] = useState<Set<string>>(new Set())
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [agentCode, setAgentCode] = useState('')
  const [activePanel, setActivePanel] = useState<'templates' | 'adapters' | 'keys' | 'deploy' | 'settings' | null>(null)
  const initialSettings = useMemo(() => loadSettings(), [])
  const [geminiKey, setGeminiKey] = useState(initialSettings.geminiKey)
  const [serverConfig, setServerConfig] = useState<{ server_has_gemini_key: boolean; auth_mode: string; version?: string } | null>(null)
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => generateId())
  const [sessionSearch, setSessionSearch] = useState('')
  const modelOptions: Record<string, string> = {
    '3 Flash': 'gemini-3-flash-preview',
    '3 Pro': 'gemini-3-pro-preview',
    '3.1 Flash Lite': 'gemini-3.1-flash-lite',
    '3.1 Pro': 'gemini-3.1-pro-preview',
    '3.5 Flash': 'gemini-3.5-flash',
  }
  const [selectedModel, setSelectedModel] = useState(initialSettings.defaultModel)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then((data: { templates: Template[]; adapters: Adapter[] }) => {
        setTemplates(data.templates)
        setAllAdapters(data.adapters)
      })
    fetch('/api/config')
      .then(r => r.ok ? r.json() : null)
      .then(setServerConfig)
      .catch(() => setServerConfig(null))
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  // Persist active session whenever its content changes
  useEffect(() => {
    if (!activeSessionId) return
    const hasConv = messages.some(m => m.role === 'user' || m.role === 'assistant')
    if (!hasConv) return
    setSessions(prev => {
      const firstUser = messages.find(m => m.role === 'user')
      const title = firstUser ? firstUser.content.slice(0, 48) : 'New session'
      const updated: Session = {
        id: activeSessionId,
        title,
        messages,
        template: selectedTemplate?.name || null,
        adapters: Array.from(selectedAdapters),
        envVars,
        createdAt: prev.find(s => s.id === activeSessionId)?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }
      const others = prev.filter(s => s.id !== activeSessionId)
      const next = [updated, ...others]
      saveSessions(next)
      return next
    })
  }, [messages, activeSessionId, selectedTemplate, selectedAdapters, envVars])

  function newSession() {
    setActiveSessionId(generateId())
    setMessages([
      {
        id: generateId(),
        role: 'system',
        content: 'Welcome to Cybernetics Composer. Type a message to chat with Gemini 3, or try:\n• "show templates" — browse agent templates\n• "use gitlab and google-cloud-run" — pick adapters\n• "set GITLAB_TOKEN=xxx" — configure keys\n• "compose" — generate a Gemini-built agent\n• "deploy to us-central1" — ship to Cloud Run',
        timestamp: new Date(),
      },
    ])
    setSelectedTemplate(null)
    setSelectedAdapters(new Set())
    setEnvVars({})
    setAgentCode('')
    setWelcomeOpen(true)
    setActivePanel(null)
  }

  function loadSession(id: string) {
    const s = sessions.find(x => x.id === id)
    if (!s) return
    setActiveSessionId(s.id)
    setMessages(s.messages.length > 0 ? s.messages : messages)
    setSelectedTemplate(s.template ? (templates.find(t => t.name === s.template) || null) : null)
    setSelectedAdapters(new Set(s.adapters))
    setEnvVars(s.envVars || {})
    setWelcomeOpen(false)
    setActivePanel(null)
  }

  function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      saveSessions(next)
      return next
    })
    if (id === activeSessionId) newSession()
  }

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
    const selected = selectedAdapters.has(a.name)
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
        className={`retro-card text-left p-4 transition-all ${selected ? 'retro-card-selected' : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-black text-base capitalize">{a.name}</div>
          {selected && <Check className="w-5 h-5 text-[#09217f]" />}
        </div>
        <div className="text-sm font-bold mt-1 opacity-80">{a.description}</div>
        {a.source && (
          <a
            href={a.source}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
            className="text-xs font-bold text-[#071a7a] underline decoration-2 underline-offset-2 mt-2 inline-block hover:text-[#0b2db3]"
          >
            Source ↗
          </a>
        )}
      </button>
    )
  }

  function renderAdapterGrid(items: Adapter[], compact = false) {
    const { grouped, ungrouped } = groupAdapters(items)
    const allItems = [...ungrouped]
    for (const [, groupItems] of grouped) {
      allItems.push(...groupItems)
    }
    return (
      <div className={`grid gap-3 ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
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

  async function handleDeploy(projectId: string, region: string, serviceName: string, gcpSaJson?: string) {
    setIsTyping(true)
    try {
      const body: Record<string, unknown> = {
        project_id: projectId,
        region,
        service_name: serviceName || `cybernetics-${selectedTemplate?.name || 'agent'}`,
        agent_code: agentCode,
      }
      if (gcpSaJson && gcpSaJson.trim()) {
        body.gcp_sa_json = gcpSaJson
      }
      const r = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      const isLive = data.mode === 'live' && data.status === 'deployed'
      const header = isLive
        ? `✅ Deployed to Cloud Run\n\n**Service URL:** ${data.service_url || '(provisioning)'}`
        : data.message || 'Deploy result:'
      const cmdBlock = data.command ? `\n\n**Command:**\n\`\`\`bash\n${data.command}\n\`\`\`` : ''
      const logsBlock = data.logs ? `\n\n<details><summary>Build logs</summary>\n\n\`\`\`\n${data.logs}\n\`\`\`\n</details>` : ''
      addMessage({ role: 'assistant', content: header + cmdBlock + logsBlock })
    } catch (err: any) {
      addMessage({ role: 'assistant', content: `Deploy failed: ${err.message}` })
    } finally {
      setIsTyping(false)
    }
  }

  // readFileAsText reads a File from a <input type="file"> picker into a string.
  async function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error || new Error('file read failed'))
      reader.readAsText(file)
    })
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

  function persistSettings(patch: Partial<Settings>) {
    const next = { ...loadSettings(), ...patch }
    saveSettings(next)
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    addMessage({ role: 'system', content: 'Copied to clipboard.' })
  }

  function renderMessage(msg: Message) {
    if (msg.action === 'templates') {
      const items: Template[] = msg.actionData || templates
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {items.map((t: Template) => (
            <button
              key={t.name}
              onClick={() => selectTemplate(t)}
              className={`retro-card text-left p-4 transition-all ${
                selectedTemplate?.name === t.name ? 'retro-card-selected' : ''
              }`}
            >
              <div className="font-black text-base capitalize">{t.name}</div>
              <div className="text-sm font-bold opacity-80 mt-1">{t.description}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {t.adapters.map((a: string) => (
                  <span key={a} className="retro-chip">{a}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )
    }

    if (msg.action === 'adapters') {
      const items: Adapter[] = msg.actionData || allAdapters
      return renderAdapterGrid(items, true)
    }

    if (msg.action === 'keys') {
      const keys: string[] = msg.actionData || getRequiredKeys()
      if (keys.length === 0) {
        return <div className="text-sm font-bold opacity-70 mt-2">No keys required for selected adapters.</div>
      }
      return (
        <div className="space-y-2 mt-2">
          {keys.map((key: string) => (
            <div key={key} className="flex gap-2 items-center">
              <span className="text-sm font-black w-40 shrink-0">{key}</span>
              <input
                type="text"
                value={envVars[key] || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEnvVars(prev => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={`Enter ${key}`}
                className="retro-input flex-1 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )
    }

    if (msg.action === 'composed' && msg.actionData) {
      const { code, dockerfile: df } = msg.actionData
      return (
        <div className="space-y-3 mt-3">
          <div className="retro-code">
            <div className="retro-code-head">
              <span>agent.py</span>
              <button onClick={() => copyCode(code)} className="text-[#9fb4d8] hover:text-white">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <pre><code>{code}</code></pre>
          </div>
          {df && (
            <div className="retro-code">
              <div className="retro-code-head"><span>Dockerfile</span></div>
              <pre>{df}</pre>
            </div>
          )}
        </div>
      )
    }

    if (msg.action === 'deploy') {
      return (
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-1 gap-2">
            <input type="text" placeholder="GCP Project ID" className="retro-input px-3 py-2 text-sm deploy-project" />
            <select defaultValue="us-central1" className="retro-input px-3 py-2 text-sm deploy-region">
              {CLOUD_RUN_REGIONS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.regions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </optgroup>
              ))}
            </select>
            <input type="text" placeholder="Service name" className="retro-input px-3 py-2 text-sm deploy-service" />
          </div>
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              const parent = e.currentTarget.parentElement
              const project = (parent?.querySelector('.deploy-project') as HTMLInputElement)?.value || ''
              const region  = (parent?.querySelector('.deploy-region')  as HTMLSelectElement)?.value || 'us-central1'
              const svc     = (parent?.querySelector('.deploy-service') as HTMLInputElement)?.value || ''
              handleDeploy(project, region, svc)
            }}
            className="retro-button flex items-center gap-2 px-4 py-2 text-sm font-black"
          >
            <Cloud className="w-5 h-5 text-[#071a7a]" /> Deploy
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

  function panelHeader(icon: React.ReactNode, title: string, subtitle?: string) {
    return (
      <div className="flex items-center justify-between gap-4 border-b-2 border-[#5d5850] bg-[#09217f] px-6 py-4 text-white">
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-wide truncate">{title}</h2>
            {subtitle && <div className="text-sm font-bold opacity-90 truncate">{subtitle}</div>}
          </div>
        </div>
        <button onClick={() => setActivePanel(null)} className="retro-button grid h-11 w-11 shrink-0 place-items-center" title="Close">
          <X className="w-5 h-5 text-[#071a7a]" />
        </button>
      </div>
    )
  }

  function renderFullPanel() {
    if (activePanel === 'templates') {
      return (
        <div className="flex flex-col h-full bg-[#d8d4cd]">
          {panelHeader(<LayoutTemplate className="w-8 h-8 text-[#58ff3e]" />, 'Templates', `${templates.length} agent blueprints`)}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((t: Template) => (
                <button
                  key={t.name}
                  onClick={() => { selectTemplate(t); setActivePanel(null) }}
                  className={`retro-card text-left p-4 transition-all ${selectedTemplate?.name === t.name ? 'retro-card-selected' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-black text-lg capitalize">{t.name}</div>
                    {selectedTemplate?.name === t.name && <Check className="w-5 h-5 text-[#09217f]" />}
                  </div>
                  <div className="text-sm font-bold opacity-80 mt-1">{t.description}</div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.adapters.map((a: string) => (
                      <span key={a} className="retro-chip">{a}</span>
                    ))}
                  </div>
                  {t.phases?.length > 0 && (
                    <div className="mt-3 text-xs font-black uppercase tracking-wider opacity-70">
                      {t.phases.join(' → ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (activePanel === 'adapters') {
      return (
        <div className="flex flex-col h-full bg-[#d8d4cd]">
          {panelHeader(<Plug className="w-8 h-8 text-[#58ff3e]" />, 'MCP Adapters', `${selectedAdapters.size}/${allAdapters.length} selected`)}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {renderAdapterGrid(allAdapters)}
          </div>
        </div>
      )
    }

    if (activePanel === 'keys') {
      const keys = getRequiredKeys()
      return (
        <div className="flex flex-col h-full bg-[#d8d4cd]">
          {panelHeader(<Plug className="w-8 h-8 text-[#58ff3e]" />, 'Service Keys', `${keys.length} required by selected adapters`)}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {keys.length === 0 ? (
              <div className="max-w-[680px] border-2 border-[#5d5850] bg-[#dedad3] p-6 shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
                <div className="flex items-start gap-3">
                  <Info className="h-7 w-7 shrink-0 text-[#071a7a]" />
                  <p className="text-base font-bold">No keys required. Pick adapters first from the Adapters tab.</p>
                </div>
              </div>
            ) : (
              <div className="max-w-[820px] space-y-3">
                {keys.map((key: string) => (
                  <div key={key} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <label className="text-sm font-black sm:w-56 shrink-0">{key}</label>
                    <input
                      type="text"
                      value={envVars[key] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnvVars(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Enter ${key}`}
                      className="retro-input flex-1 px-3 py-2 text-base font-bold"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    if (activePanel === 'settings') {
      return (
        <div className="flex flex-col h-full bg-[#d8d4cd]">
          {panelHeader(<Settings className="w-8 h-8 text-[#58ff3e]" />, 'Settings', 'Preferences & API keys')}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            <div className="max-w-[820px] space-y-6">
              {serverConfig?.server_has_gemini_key ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-wider">Gemini API Key</h3>
                  <div className="border-2 border-[#5d5850] bg-[#dedad3] p-4 shadow-[3px_3px_0_rgba(0,0,0,0.25)]">
                    <p className="text-sm font-bold">
                      <span className="inline-block h-3 w-3 bg-[#39e94c] mr-2 align-middle" />
                      Server has a managed Gemini key. Client-side keys are disabled in this deployment.
                    </p>
                  </div>
                </section>
              ) : (
                <section className="space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-wider">Gemini API Key</h3>
                  <input
                    type="text"
                    value={geminiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setGeminiKey(e.target.value); persistSettings({ geminiKey: e.target.value }) }}
                    placeholder="AIzaSy…"
                    className="retro-input w-full px-3 py-2 text-base font-bold"
                  />
                  <p className="text-xs font-bold opacity-70">Stored locally in your browser. Used as fallback when the server has no GEMINI_API_KEY. <strong>Not recommended for production.</strong></p>
                </section>
              )}
              <section className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wider">Auth Mode</h3>
                <p className="text-sm font-bold opacity-80">
                  {serverConfig?.auth_mode === 'oidc' && 'OIDC (JWT verification)'}
                  {serverConfig?.auth_mode === 'bearer' && 'Bearer token'}
                  {serverConfig?.auth_mode === 'none' && 'None (dev mode)'}
                  {!serverConfig && 'unknown'}
                  {serverConfig?.version && <span className="opacity-60"> · v{serverConfig.version}</span>}
                </p>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-black uppercase tracking-wider">Default Model</h3>
                <select
                  value={selectedModel}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedModel(e.target.value); persistSettings({ defaultModel: e.target.value }) }}
                  className="retro-input w-full px-3 py-2 text-base font-black"
                >
                  {Object.entries(modelOptions).map(([label, id]) => (
                    <option key={id} value={id}>Gemini {label}</option>
                  ))}
                </select>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-black uppercase tracking-wider">Session History</h3>
                <p className="text-sm font-bold opacity-80">{sessions.length} stored session(s).</p>
                <button
                  onClick={() => {
                    if (!confirm('Delete all sessions? This cannot be undone.')) return
                    setSessions([])
                    saveSessions([])
                    newSession()
                  }}
                  className="retro-button flex items-center gap-2 px-4 py-2 text-sm font-black"
                >
                  <Trash2 className="w-5 h-5 text-[#071a7a]" /> Clear all sessions
                </button>
              </section>
            </div>
          </div>
        </div>
      )
    }

    if (activePanel === 'deploy') {
      return (
        <div className="flex flex-col h-full bg-[#d8d4cd]">
          {panelHeader(<Rocket className="w-8 h-8 text-[#58ff3e]" />, 'Deploy', 'Cloud Run target')}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            <div className="max-w-[820px] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-1">Project ID</label>
                  <input type="text" id="deploy-project" placeholder="my-gcp-project" className="retro-input w-full px-3 py-2 text-base font-bold" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-1">Region</label>
                  <select id="deploy-region" defaultValue="us-central1" className="retro-input w-full px-3 py-2 text-base font-bold">
                    {CLOUD_RUN_REGIONS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.regions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-1">Service Name</label>
                  <input type="text" id="deploy-service" placeholder={`cybernetics-${selectedTemplate?.name || 'agent'}`} className="retro-input w-full px-3 py-2 text-base font-bold" />
                </div>
              </div>

              <div className="retro-card p-4 space-y-2">
                <label className="text-xs font-black uppercase tracking-wider block">GCP Service-Account JSON (optional)</label>
                <p className="text-xs opacity-70 leading-snug">
                  Drop in a key for a SA with <code>Cloud Run Admin</code> + <code>Cloud Build Editor</code> + <code>Storage Admin</code> + <code>Service Account User</code> roles to <strong>actually deploy</strong>. Leave empty to get the gcloud command back instead. Key is held in request memory only and scrubbed on response.
                </p>
                <input
                  type="file"
                  accept="application/json,.json"
                  id="deploy-sa-file"
                  className="retro-input w-full px-3 py-2 text-sm font-bold cursor-pointer"
                />
              </div>

              <button
                onClick={async () => {
                  const p = (document.getElementById('deploy-project') as HTMLInputElement)?.value || ''
                  const r = (document.getElementById('deploy-region') as HTMLSelectElement)?.value || 'us-central1'
                  const s = (document.getElementById('deploy-service') as HTMLInputElement)?.value || ''
                  const fileInput = document.getElementById('deploy-sa-file') as HTMLInputElement | null
                  let sa = ''
                  if (fileInput?.files && fileInput.files[0]) {
                    try { sa = await readFileAsText(fileInput.files[0]) } catch { sa = '' }
                  }
                  setActivePanel(null)
                  handleDeploy(p, r, s, sa)
                }}
                className="retro-button flex items-center gap-3 px-6 py-3 text-base font-black"
              >
                <Cloud className="w-6 h-6 text-[#071a7a]" /> {`Deploy to Cloud Run`}
              </button>
            </div>
          </div>
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
          <button
            onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}
            className={`retro-icon-button mt-3 ${activePanel === 'settings' ? 'bg-[#09217f] text-white' : 'text-[#0a1880]'}`}
            title="Settings"
            aria-pressed={activePanel === 'settings'}
          >
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
        <aside className="hidden lg:block w-[324px] shrink-0 border-r-2 border-[#706b63] bg-[#d8d4cd] p-5 overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black tracking-wide">SESSION HISTORY</h2>
            <button onClick={newSession} className="retro-button flex items-center gap-2 px-3 py-2 text-sm font-bold">
              <Plus className="w-4 h-4 text-[#071a7a]" /> New
            </button>
          </div>
          <label className="mt-6 flex items-center gap-3 border-2 border-[#7d776d] bg-[#eeeae4] px-3 py-3 shadow-inner">
            <Search className="w-6 h-6" />
            <input
              value={sessionSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionSearch(e.target.value)}
              className="w-full bg-transparent text-lg outline-none placeholder:text-[#4d4a47]"
              placeholder="Search sessions..."
            />
          </label>

          <div className="mt-7 space-y-2 text-sm">
            {sessions.length === 0 && (
              <div className="text-sm font-bold opacity-70 px-1">No sessions yet. Send a message to start one.</div>
            )}
            {sessions
              .filter(s => !sessionSearch || s.title.toLowerCase().includes(sessionSearch.toLowerCase()))
              .map(s => {
                const active = s.id === activeSessionId
                return (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={`group w-full text-left p-3 border-2 transition-colors ${
                      active
                        ? 'border-[#06124f] bg-[#09217f] text-white shadow-[inset_0_0_0_1px_#1e4bd7]'
                        : 'border-[#8b857b] bg-[#eeeae4] hover:bg-[#e3dfd8]'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <Terminal className={`w-4 h-4 ${active ? 'text-[#62ff39]' : 'text-[#071a7a]'}`} />
                      <span className="truncate flex-1">{s.title}</span>
                      <span
                        role="button"
                        onClick={(e: React.MouseEvent) => deleteSession(s.id, e)}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'text-white' : 'text-[#071a7a]'}`}
                        title="Delete session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </span>
                    </div>
                    <div className={`ml-6 mt-1 text-xs ${active ? 'text-[#bcd0ff]' : 'opacity-70'}`}>
                      {(s.adapters.slice(0, 3).join(' · ') || 'no adapters')} · {formatRelative(s.updatedAt)}
                    </div>
                  </button>
                )
              })}
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
              <button onClick={() => setActivePanel(activePanel === 'keys' ? null : 'keys')} className="retro-button toolbar-button">
                <Plug className="w-6 h-6 text-[#071a7a]" />Keys
                {getRequiredKeys().length > 0 && <span className="ml-1 text-xs">({getRequiredKeys().length})</span>}
              </button>
              <button onClick={() => setActivePanel(activePanel === 'deploy' ? null : 'deploy')} className="retro-button toolbar-button"><Rocket className="w-6 h-6 text-[#071a7a]" />Deploy</button>
            </div>
          </div>

          {activePanel ? (
            <div className="flex-1 min-h-0">
              {renderFullPanel()}
            </div>
          ) : (
          <div className="blueprint-grid composer-workspace relative flex flex-1 overflow-hidden p-8">
            <div className={`blueprint-schematic blueprint-schematic-${blueprintState}`} aria-hidden="true">
              <img
                src="/assets/cybernetic-blueprint.png"
                alt=""
                className="blueprint-image"
                draggable={false}
              />
            </div>
            <div ref={scrollRef} className={`z-10 flex-1 overflow-y-auto pr-5 scrollbar-thin ${showWelcome ? 'flex items-center justify-center' : ''}`}>
              {showWelcome && (
                <div className="composer-welcome w-full max-w-[680px] border-2 border-[#5d5850] bg-[#dedad3] p-5 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
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
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider">
                    <span className="border-2 border-[#5d5850] bg-[#fc6d26] px-2 py-1 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]">GitLab Track</span>
                    <span className="border-2 border-[#5d5850] bg-[#1a73e8] px-2 py-1 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]">Gemini 3</span>
                    <span className="border-2 border-[#5d5850] bg-[#0f9d58] px-2 py-1 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]">Google Cloud Run MCP</span>
                    <span className="border-2 border-[#5d5850] bg-[#4285f4] px-2 py-1 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]">Google Observability MCP</span>
                  </div>
                  <p className="mb-3 text-base font-bold">
                    A composable meta-MCP that turns <span className="text-[#fc6d26]">GitLab</span> + <span className="text-[#1a73e8]">Google Cloud</span> MCP servers into one auditable agent control plane. Try:
                  </p>
                  <div className="space-y-2 text-base font-bold">
                    {[
                      ['show templates', 'browse agent templates'],
                      ['use gitlab and google-cloud-run', 'GitLab MR + Cloud Run deploy'],
                      ['set GITLAB_TOKEN=xxx', 'configure keys'],
                      ['compose', 'Gemini 3 generates the agent'],
                      ['deploy to us-central1', 'ship to Cloud Run'],
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
          )}

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
