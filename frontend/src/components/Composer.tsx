import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Cpu, Check, Copy, Cloud, LayoutTemplate, Plug, Rocket, X, Server,
  Info, Code2, Settings, Trash2, CloudLightning,
} from 'lucide-react'
import { AgentInput } from './ArqonNav'
import { SettingsModal } from '@arqon/global-ux'

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
  return { geminiKey: '', defaultModel: 'google/gemini-3-flash-preview' }
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
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

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

interface ComposerProps {
  onSessionsChange?: (sessions: Session[]) => void
  onActiveSessionChange?: (id: string | null) => void
  registerLoadSession?: (fn: (id: string) => void) => void
  registerDeleteSession?: (fn: (id: string) => void) => void
  registerNewSession?: (fn: () => void) => void
  registerSessionActions?: (actions: {
    newSession: () => void
    loadSession: (id: string) => void
    deleteSession: (id: string) => void
  }) => void
}

export function Composer({
  onSessionsChange,
  onActiveSessionChange,
  registerLoadSession,
  registerDeleteSession,
  registerNewSession,
  registerSessionActions,
}: ComposerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: 'system',
      content: 'Welcome to agent.Arqon. Type a message to chat, or try:\n• "show templates" — browse agent templates\n• "use datadog and slack" — pick adapters\n• "set DATADOG_API_KEY=xxx" — configure keys\n• "compose" — generate agent code\n• "deploy to us-central1" — deploy to Cloud Run',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [welcomeOpen, setWelcomeOpen] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [allAdapters, setAllAdapters] = useState<Adapter[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedAdapters, setSelectedAdapters] = useState<Set<string>>(new Set())
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [agentCode, setAgentCode] = useState('')
  const [activePanel, setActivePanel] = useState<'templates' | 'adapters' | 'keys' | 'deploy' | null>(null)
  const [deployTarget, setDeployTarget] = useState<'gcp' | 'cloudflare' | 'aws' | 'azure'>('gcp')
  const initialSettings = useMemo(() => loadSettings(), [])
  const [geminiKey, setGeminiKey] = useState(initialSettings.geminiKey)
  const [serverConfig, setServerConfig] = useState<{ server_has_gemini_key: boolean; auth_mode: string; version?: string } | null>(null)
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => generateId())
  const [selectedProvider, setSelectedProvider] = useState(() => localStorage.getItem('arqon-agent-provider') || 'google')
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('arqon-agent-model') || 'google/gemini-3-flash-preview')
  const [showSettings, setShowSettings] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onSessionsChange?.(sessions)
  }, [sessions, onSessionsChange])

  useEffect(() => {
    onActiveSessionChange?.(activeSessionId)
  }, [activeSessionId, onActiveSessionChange])

  useEffect(() => {
    registerSessionActions?.({ newSession, loadSession, deleteSession })
  }, [registerSessionActions, sessions, templates, messages])

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
        content: 'Welcome to agent.Arqon. Type a message to chat, or try:\n• "show templates" — browse agent templates\n• "use datadog and slack" — pick adapters\n• "set DATADOG_API_KEY=xxx" — configure keys\n• "compose" — generate agent code\n• "deploy to us-central1" — deploy to Cloud Run',
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

  function deleteSession(id: string) {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      saveSessions(next)
      return next
    })
    if (id === activeSessionId) newSession()
  }

  // Wire up external callbacks
  useEffect(() => {
    registerLoadSession?.(loadSession)
  }, [registerLoadSession])

  useEffect(() => {
    registerDeleteSession?.(deleteSession)
  }, [registerDeleteSession])

  useEffect(() => {
    registerNewSession?.(newSession)
  }, [registerNewSession])

  // Expose settings toggle for sidebar
  useEffect(() => {
    const handler = () => setShowSettings(true)
    window.addEventListener('arqon-agent-open-settings', handler)
    return () => window.removeEventListener('arqon-agent-open-settings', handler)
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
        className={`text-left p-4 rounded-xl border transition-all ${
          selected
            ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 dark:border-cyan-600'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-base capitalize text-gray-900 dark:text-white">{a.name}</div>
          {selected && <Check className="w-5 h-5 text-cyan-500" />}
        </div>
        <div className="text-sm mt-1 text-gray-500 dark:text-gray-400">{a.description}</div>
        {a.source && (
          <a
            href={a.source}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
            className="text-xs text-cyan-600 dark:text-cyan-400 underline mt-2 inline-block hover:text-cyan-700 dark:hover:text-cyan-300"
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

      switch (data.action) {
        case 'show_templates':
          addMessage({ role: 'system', content: 'templates', action: 'templates', actionData: templates })
          break
        case 'show_adapters':
          addMessage({ role: 'system', content: 'adapters', action: 'adapters', actionData: allAdapters })
          break
        case 'show_keys':
          addMessage({ role: 'system', content: 'keys', action: 'keys', actionData: getRequiredKeys() })
          break
        case 'show_deploy':
          addMessage({ role: 'system', content: 'deploy', action: 'deploy' })
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
          service_name: serviceName || `arqon-${selectedTemplate?.name || 'agent'}`,
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

  async function handleDeployCloudflare(accountId: string, workerName: string, apiToken: string) {
    setIsTyping(true)
    try {
      const r = await fetch('/api/deploy/cloudflare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          worker_name: workerName || `arqon-${selectedTemplate?.name || 'agent'}`,
          api_token: apiToken,
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

  async function handleDeployAWS(region: string, functionName: string, accessKeyId: string, secretAccessKey: string) {
    setIsTyping(true)
    try {
      const r = await fetch('/api/deploy/aws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region,
          function_name: functionName || `arqon-${selectedTemplate?.name || 'agent'}`,
          access_key_id: accessKeyId,
          secret_access_key: secretAccessKey,
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

  async function handleDeployAzure(subscriptionId: string, resourceGroup: string, appName: string, region: string) {
    setIsTyping(true)
    try {
      const r = await fetch('/api/deploy/azure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_id: subscriptionId,
          resource_group: resourceGroup,
          app_name: appName || `arqon-${selectedTemplate?.name || 'agent'}`,
          region,
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
    const keyMatch = text.match(/^set\s+(\w+)=(.+)$/i)
    if (keyMatch) {
      const [, key, value] = keyMatch
      setEnvVars(prev => ({ ...prev, [key]: value }))
      addMessage({ role: 'user', content: text })
      addMessage({ role: 'assistant', content: `Set \`${key}\` = \`***\`` })
      return
    }
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
      addMessage({ role: 'assistant', content: `Selected adapters: ${valid.join(', ') || 'none'}` })
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
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedTemplate?.name === t.name
                  ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 dark:border-cyan-600'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-base capitalize text-gray-900 dark:text-white">{t.name}</div>
              <div className="text-sm mt-1 text-gray-500 dark:text-gray-400">{t.description}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {t.adapters.map((a: string) => (
                  <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{a}</span>
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
        return <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">No keys required for selected adapters.</div>
      }
      return (
        <div className="space-y-2 mt-2">
          {keys.map((key: string) => (
            <div key={key} className="flex gap-2 items-center">
              <span className="text-sm font-medium w-40 shrink-0 text-gray-700 dark:text-gray-300">{key}</span>
              <input
                type="text"
                value={envVars[key] || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEnvVars(prev => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={`Enter ${key}`}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400"
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
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-[#1f2937] border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">agent.py</span>
              <button onClick={() => copyCode(code)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <pre className="bg-[#0d1117] text-[#e6edf3] p-4 text-xs overflow-auto max-h-96"><code>{code}</code></pre>
          </div>
          {df && (
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-2 bg-gray-100 dark:bg-[#1f2937] border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Dockerfile</span>
              </div>
              <pre className="bg-[#0d1117] text-[#e6edf3] p-4 text-xs overflow-auto max-h-96">{df}</pre>
            </div>
          )}
        </div>
      )
    }

    if (msg.action === 'deploy') {
      return (
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-1 gap-2">
            <input type="text" placeholder="GCP Project ID" className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  const inputs = (e.currentTarget.parentElement?.querySelectorAll('input') as NodeListOf<HTMLInputElement>)
                  handleDeploy(inputs[0].value, inputs[1].value || 'us-central1', inputs[2].value)
                }
              }}
            />
            <input type="text" placeholder="Region (default: us-central1)" defaultValue="us-central1" className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
            <input type="text" placeholder="Service name" className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
          </div>
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              const inputs = (e.currentTarget.parentElement?.querySelectorAll('input') as NodeListOf<HTMLInputElement>)
              handleDeploy(inputs[0].value, inputs[1].value || 'us-central1', inputs[2].value)
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <Cloud className="w-5 h-5" /> Deploy
          </button>
        </div>
      )
    }

    const lines = msg.content.split('\n')
    return (
      <div className={`text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
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
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-wide truncate text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</div>}
          </div>
        </div>
        <button onClick={() => setActivePanel(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Close">
          <X className="w-5 h-5" />
        </button>
      </div>
    )
  }

  function renderFullPanel() {
    if (activePanel === 'templates') {
      return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0a0a0a]">
          {panelHeader(<LayoutTemplate className="w-5 h-5 text-cyan-500" />, 'Templates', `${templates.length} agent blueprints`)}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((t: Template) => (
                <button
                  key={t.name}
                  onClick={() => { selectTemplate(t); setActivePanel(null) }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedTemplate?.name === t.name
                      ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 dark:border-cyan-600'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-lg capitalize text-gray-900 dark:text-white">{t.name}</div>
                    {selectedTemplate?.name === t.name && <Check className="w-5 h-5 text-cyan-500" />}
                  </div>
                  <div className="text-sm mt-1 text-gray-500 dark:text-gray-400">{t.description}</div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.adapters.map((a: string) => (
                      <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{a}</span>
                    ))}
                  </div>
                  {t.phases?.length > 0 && (
                    <div className="mt-3 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0a0a0a]">
          {panelHeader(<Plug className="w-5 h-5 text-cyan-500" />, 'MCP Adapters', `${selectedAdapters.size}/${allAdapters.length} selected`)}
          <div className="flex-1 overflow-y-auto p-6">
            {renderAdapterGrid(allAdapters)}
          </div>
        </div>
      )
    }

    if (activePanel === 'keys') {
      const keys = getRequiredKeys()
      return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0a0a0a]">
          {panelHeader(<Plug className="w-5 h-5 text-cyan-500" />, 'Service Keys', `${keys.length} required by selected adapters`)}
          <div className="flex-1 overflow-y-auto p-6">
            {keys.length === 0 ? (
              <div className="max-w-[680px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-6">
                <div className="flex items-start gap-3">
                  <Info className="h-6 w-6 shrink-0 text-cyan-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">No keys required. Pick adapters first from the Adapters tab.</p>
                </div>
              </div>
            ) : (
              <div className="max-w-[820px] space-y-3">
                {keys.map((key: string) => (
                  <div key={key} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <label className="text-sm font-medium sm:w-56 shrink-0 text-gray-700 dark:text-gray-300">{key}</label>
                    <input
                      type="text"
                      value={envVars[key] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnvVars(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Enter ${key}`}
                      className="flex-1 px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    if (activePanel === 'deploy') {
      const deployTargets = [
        { id: 'gcp' as const, label: 'Google Cloud Run', icon: Cloud, color: 'text-blue-500' },
        { id: 'cloudflare' as const, label: 'Cloudflare Workers', icon: CloudLightning, color: 'text-orange-500' },
        { id: 'aws' as const, label: 'AWS Lambda', icon: Cloud, color: 'text-amber-600' },
        { id: 'azure' as const, label: 'Azure Container Apps', icon: Cloud, color: 'text-sky-600' },
      ]
      return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0a0a0a]">
          {panelHeader(<Rocket className="w-5 h-5 text-cyan-500" />, 'Deploy', 'Cloud target')}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-[820px] space-y-4">
              {/* Deploy target selector */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider block mb-2 text-gray-500 dark:text-gray-400">Deploy Target</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {deployTargets.map(t => {
                    const Icon = t.icon
                    return (
                      <button
                        key={t.id}
                        onClick={() => setDeployTarget(t.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                          deployTarget === t.id
                            ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${t.color}`} />
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* GCP Cloud Run fields */}
              {deployTarget === 'gcp' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Project ID</label>
                    <input type="text" id="deploy-project" placeholder="my-gcp-project" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Region</label>
                    <input type="text" id="deploy-region" defaultValue="us-central1" placeholder="us-central1" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Service Name</label>
                    <input type="text" id="deploy-service" placeholder={`arqon-${selectedTemplate?.name || 'agent'}`} className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                </div>
              )}

              {/* Cloudflare Workers fields */}
              {deployTarget === 'cloudflare' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Account ID</label>
                    <input type="text" id="deploy-cf-account" placeholder="your-account-id" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Worker Name</label>
                    <input type="text" id="deploy-cf-worker" placeholder={`arqon-${selectedTemplate?.name || 'agent'}`} className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">API Token</label>
                    <input type="password" id="deploy-cf-token" placeholder="CF API token" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                </div>
              )}

              {/* AWS Lambda fields */}
              {deployTarget === 'aws' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">AWS Region</label>
                    <input type="text" id="deploy-aws-region" defaultValue="us-east-1" placeholder="us-east-1" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Function Name</label>
                    <input type="text" id="deploy-aws-function" placeholder={`arqon-${selectedTemplate?.name || 'agent'}`} className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Access Key ID</label>
                    <input type="text" id="deploy-aws-key" placeholder="AKIA..." className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Secret Access Key</label>
                    <input type="password" id="deploy-aws-secret" placeholder="Secret key" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                </div>
              )}

              {/* Azure Container Apps fields */}
              {deployTarget === 'azure' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Subscription ID</label>
                    <input type="text" id="deploy-azure-sub" placeholder="subscription-uuid" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Resource Group</label>
                    <input type="text" id="deploy-azure-rg" placeholder="my-resource-group" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">App Name</label>
                    <input type="text" id="deploy-azure-app" placeholder={`arqon-${selectedTemplate?.name || 'agent'}`} className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider block mb-1 text-gray-500 dark:text-gray-400">Region</label>
                    <input type="text" id="deploy-azure-region" defaultValue="eastus" placeholder="eastus" className="w-full px-3 py-2 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (deployTarget === 'gcp') {
                    const p = (document.getElementById('deploy-project') as HTMLInputElement)?.value || ''
                    const r = (document.getElementById('deploy-region') as HTMLInputElement)?.value || 'us-central1'
                    const s = (document.getElementById('deploy-service') as HTMLInputElement)?.value || ''
                    setActivePanel(null)
                    handleDeploy(p, r, s)
                  } else if (deployTarget === 'cloudflare') {
                    const acct = (document.getElementById('deploy-cf-account') as HTMLInputElement)?.value || ''
                    const worker = (document.getElementById('deploy-cf-worker') as HTMLInputElement)?.value || ''
                    const token = (document.getElementById('deploy-cf-token') as HTMLInputElement)?.value || ''
                    setActivePanel(null)
                    handleDeployCloudflare(acct, worker, token)
                  } else if (deployTarget === 'aws') {
                    const region = (document.getElementById('deploy-aws-region') as HTMLInputElement)?.value || 'us-east-1'
                    const fnName = (document.getElementById('deploy-aws-function') as HTMLInputElement)?.value || ''
                    const keyId = (document.getElementById('deploy-aws-key') as HTMLInputElement)?.value || ''
                    const secret = (document.getElementById('deploy-aws-secret') as HTMLInputElement)?.value || ''
                    setActivePanel(null)
                    handleDeployAWS(region, fnName, keyId, secret)
                  } else if (deployTarget === 'azure') {
                    const sub = (document.getElementById('deploy-azure-sub') as HTMLInputElement)?.value || ''
                    const rg = (document.getElementById('deploy-azure-rg') as HTMLInputElement)?.value || ''
                    const app = (document.getElementById('deploy-azure-app') as HTMLInputElement)?.value || ''
                    const region = (document.getElementById('deploy-azure-region') as HTMLInputElement)?.value || 'eastus'
                    setActivePanel(null)
                    handleDeployAzure(sub, rg, app, region)
                  }
                }}
                className="flex items-center gap-3 px-6 py-3 text-base font-medium rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                <Cloud className="w-6 h-6" /> Deploy to {deployTargets.find(t => t.id === deployTarget)?.label}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  const hasConversation = messages.some(msg => msg.role === 'user' || msg.role === 'assistant')
  const showWelcome = welcomeOpen && !hasConversation

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex min-h-[48px] items-center gap-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0a0a] px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePanel(activePanel === 'templates' ? null : 'templates')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activePanel === 'templates'
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <LayoutTemplate className="w-4 h-4" /> Templates
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'adapters' ? null : 'adapters')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activePanel === 'adapters'
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Server className="w-4 h-4" /> Adapters
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'keys' ? null : 'keys')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activePanel === 'keys'
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Plug className="w-4 h-4" /> Keys
              {getRequiredKeys().length > 0 && <span className="ml-1 text-xs">({getRequiredKeys().length})</span>}
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'deploy' ? null : 'deploy')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activePanel === 'deploy'
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Rocket className="w-4 h-4" /> Deploy
            </button>
          </div>
        </div>

        {activePanel ? (
          <div className="flex-1 min-h-0">
            {renderFullPanel()}
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden flex-col">
            <div ref={scrollRef} className={`flex-1 overflow-y-auto p-4 ${showWelcome ? 'flex items-center justify-center' : ''}`}>
              {showWelcome && (
                <div className="w-full max-w-[680px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <Info className="h-7 w-7 shrink-0 text-cyan-500" />
                    <h2 className="text-xl font-semibold leading-tight text-gray-900 dark:text-white">Welcome to agent.Arqon</h2>
                    <button
                      onClick={() => setWelcomeOpen(false)}
                      className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Close welcome message"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="my-4 border-t border-gray-100 dark:border-gray-800" />
                  <p className="mb-3 text-base text-gray-600 dark:text-gray-400">Type a message to chat, or try:</p>
                  <div className="space-y-2 text-base">
                    {[
                      ['show templates', 'browse agent templates'],
                      ['use datadog and slack', 'pick adapters'],
                      ['set DATADOG_API_KEY=xxx', 'configure keys'],
                      ['compose', 'generate agent code'],
                      ['deploy to us-central1', 'deploy to Cloud Run'],
                    ].map(([cmd, desc]) => (
                      <div key={cmd} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 rounded-full bg-cyan-500 flex-shrink-0" />
                        <span className="text-gray-600 dark:text-gray-400"><span className="text-cyan-600 dark:text-cyan-400 font-medium">{cmd}</span> — {desc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="my-4 border-t border-gray-100 dark:border-gray-800" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      onClick={() => { setActivePanel('templates'); setWelcomeOpen(false) }}
                      className="flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                    >
                      <LayoutTemplate className="w-5 h-5" /> Browse<br />Templates
                    </button>
                    <button
                      onClick={() => { setActivePanel('adapters'); setWelcomeOpen(false) }}
                      className="flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                    >
                      <Plug className="w-5 h-5" /> Connect<br />Adapter
                    </button>
                    <button
                      onClick={() => { setWelcomeOpen(false); handleCompose() }}
                      className="flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                    >
                      <Code2 className="w-5 h-5" /> Compose<br />Agent
                    </button>
                  </div>
                </div>
              )}

              {messages.length > 1 && (
                <div className="mt-5 max-w-[720px] mx-auto space-y-4">
                  {messages.slice(1).map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role !== 'user' && msg.role !== 'assistant' && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                          <Cpu className="w-4 h-4 text-cyan-500" />
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200'
                      }`}>
                        {renderMessage(msg)}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="inline-flex gap-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] rounded-2xl px-4 py-3">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-[#0a0a0a]">
              <AgentInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                isLoading={isTyping}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onProviderChange={setSelectedProvider}
                onModelChange={(m) => { setSelectedModel(m); persistSettings({ defaultModel: m }) }}
                placeholder="Message agent... (try: show templates, use slack, compose, deploy)"
              />
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
                Arqon may produce inaccurate information. Verify important facts.
              </p>
            </div>
          </div>
        )}
      </section>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        serviceName="Arqon"
        onClearAllData={() => {
          setSessions([])
          saveSessions([])
          newSession()
        }}
        dataCount={sessions.length}
        dataLabel="session"
        aiProviderConfig={{
          storagePrefix: 'arqon-agent',
          defaultProvider: selectedProvider,
          defaultModel: selectedModel,
        }}
      />
    </div>
  )
}
