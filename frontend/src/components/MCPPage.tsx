import { useState } from 'react'
import { Server, Copy, Terminal, CheckCircle, AlertCircle, BookOpen, ChevronDown, Key, Settings, Wrench } from 'lucide-react'

interface AdapterInfo {
  name: string
  description: string
  protocol: string
  preset: string[]
  secrets: string[]
  tools: string[]
  source: string
}

const adapters: AdapterInfo[] = [
  {
    name: 'dynatrace', description: 'Dynatrace observability — problems, traces, DQL',
    protocol: 'REST', preset: ['DYNATRACE_BASE_URL'], secrets: ['DYNATRACE_API_TOKEN'],
    tools: ['dynatrace_get_problems', 'dynatrace_get_traces', 'dynatrace_run_dql'],
    source: 'https://docs.dynatrace.com/docs/discover-dynatrace/references/dynatrace-api',
  },
  {
    name: 'elastic', description: 'Elastic search — incidents, runbooks, insights',
    protocol: 'REST', preset: ['ELASTIC_CLOUD_ID'], secrets: ['ELASTIC_API_KEY'],
    tools: ['elastic_search_incidents', 'elastic_search_runbooks', 'elastic_write_insight'],
    source: 'https://www.elastic.co/docs/api',
  },
  {
    name: 'postgres', description: 'Postgres — structured incident memory, patterns, and agent state',
    protocol: 'TCP', preset: ['POSTGRES_DSN'], secrets: [],
    tools: ['postgres_recall_pattern', 'postgres_store_pattern', 'postgres_log_incident', 'postgres_get_recent_incidents'],
    source: 'https://www.postgresql.org/docs/',
  },
  {
    name: 'gitlab', description: 'GitLab — issues, merge requests, CI/CD',
    protocol: 'REST', preset: ['GITLAB_URL'], secrets: ['GITLAB_TOKEN'],
    tools: ['gitlab_create_issue', 'gitlab_create_mr', 'gitlab_get_file', 'gitlab_trigger_pipeline'],
    source: 'https://docs.gitlab.com/api/',
  },
  {
    name: 'arize', description: 'Arize Phoenix — tracing, LLM-as-a-Judge',
    protocol: 'REST', preset: ['ARIZE_ENDPOINT'], secrets: ['ARIZE_API_KEY'],
    tools: ['arize_run_judge', 'arize_log_eval'],
    source: 'https://arize.com/docs/phoenix',
  },
  {
    name: 'fivetran', description: 'Fivetran — data pipeline orchestration',
    protocol: 'REST', preset: [], secrets: ['FIVETRAN_API_KEY', 'FIVETRAN_API_SECRET'],
    tools: ['fivetran_list_connectors', 'fivetran_get_connector_status', 'fivetran_sync_connector', 'fivetran_create_log_pipeline'],
    source: 'https://fivetran.com/docs/rest-api',
  },
  {
    name: 'github', description: 'GitHub — issues, pull requests, actions, repositories',
    protocol: 'REST', preset: [], secrets: ['GITHUB_TOKEN'],
    tools: ['github_create_issue', 'github_get_issue', 'github_create_pr', 'github_list_repos', 'github_trigger_workflow', 'github_search_code'],
    source: 'https://docs.github.com/en/rest',
  },
  {
    name: 'stripe', description: 'Stripe — payments, customers, subscriptions, invoices',
    protocol: 'REST', preset: [], secrets: ['STRIPE_API_KEY'],
    tools: ['stripe_create_customer', 'stripe_get_customer', 'stripe_create_charge', 'stripe_list_invoices', 'stripe_create_subscription'],
    source: 'https://docs.stripe.com/api',
  },
  {
    name: 'aws', description: 'AWS — S3, EC2, Lambda, CloudWatch',
    protocol: 'boto3', preset: ['AWS_REGION'], secrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    tools: ['aws_s3_list_buckets', 'aws_s3_list_objects', 'aws_ec2_describe_instances', 'aws_lambda_list_functions', 'aws_lambda_invoke', 'aws_cloudwatch_get_metrics'],
    source: 'https://docs.aws.amazon.com/',
  },
  {
    name: 'vercel', description: 'Vercel — deployments, projects, domains, env vars',
    protocol: 'REST', preset: [], secrets: ['VERCEL_TOKEN'],
    tools: ['vercel_list_projects', 'vercel_get_deployment', 'vercel_list_deployments', 'vercel_add_env_var'],
    source: 'https://vercel.com/docs/rest-api',
  },
  {
    name: 'supabase', description: 'Supabase — database, auth, storage, edge functions',
    protocol: 'REST', preset: ['SUPABASE_URL'], secrets: ['SUPABASE_KEY'],
    tools: ['supabase_select', 'supabase_insert', 'supabase_update', 'supabase_delete', 'supabase_rpc'],
    source: 'https://supabase.com/docs/reference',
  },
  {
    name: 'cloudflare', description: 'Cloudflare — DNS, workers, pages, zones',
    protocol: 'REST', preset: ['CLOUDFLARE_ACCOUNT_ID'], secrets: ['CLOUDFLARE_API_TOKEN'],
    tools: ['cloudflare_list_zones', 'cloudflare_list_dns', 'cloudflare_create_dns', 'cloudflare_list_workers', 'cloudflare_deploy_worker'],
    source: 'https://developers.cloudflare.com/api/',
  },
  {
    name: 'browser', description: 'Browser DevTools — navigate, evaluate JS, screenshot, network, full CDP via Playwright',
    protocol: 'WebSocket CDP', preset: ['BROWSER_CDP_HOST', 'BROWSER_CDP_PORT'], secrets: [],
    tools: ['browser_navigate', 'browser_evaluate', 'browser_screenshot', 'browser_get_network_log', 'browser_clear_cache', 'browser_get_console_log'],
    source: 'https://chromedevtools.github.io/devtools-protocol/',
  },
  {
    name: 'chrome', description: 'Chrome/Chromium browser automation via CDP WebSocket',
    protocol: 'WebSocket CDP', preset: ['BROWSER_CDP_HOST', 'BROWSER_CDP_PORT'], secrets: [],
    tools: ['chrome_navigate', 'chrome_evaluate', 'chrome_screenshot', 'chrome_get_network', 'chrome_get_console', 'chrome_clear_cache', 'chrome_set_viewport', 'chrome_click', 'chrome_type', 'chrome_pdf'],
    source: 'https://chromedevtools.github.io/devtools-protocol/',
  },
  {
    name: 'firefox', description: 'Firefox browser automation via Playwright Gecko engine',
    protocol: 'Playwright', preset: [], secrets: [],
    tools: ['firefox_navigate', 'firefox_evaluate', 'firefox_screenshot', 'firefox_get_console', 'firefox_click', 'firefox_type', 'firefox_set_viewport', 'firefox_pdf'],
    source: 'https://playwright.dev/docs/browsers',
  },
  {
    name: 'brave', description: 'Brave browser automation via Playwright (Chromium-based with privacy defaults)',
    protocol: 'Playwright', preset: [], secrets: [],
    tools: ['brave_navigate', 'brave_evaluate', 'brave_screenshot', 'brave_click', 'brave_type', 'brave_set_viewport', 'brave_pdf', 'brave_check_shields'],
    source: 'https://playwright.dev/docs/browsers',
  },
  {
    name: 'slack', description: 'Slack workspace integration via Web API',
    protocol: 'REST', preset: [], secrets: ['SLACK_BOT_TOKEN'],
    tools: ['slack_post_message', 'slack_get_channel_history', 'slack_list_channels', 'slack_search_messages', 'slack_upload_file', 'slack_get_user_info'],
    source: 'https://api.slack.com/web',
  },
  {
    name: 'kubernetes', description: 'Kubernetes cluster operations via official client or subprocess kubectl',
    protocol: 'HTTP / kubeconfig', preset: ['KUBERNETES_NAMESPACE', 'KUBECONFIG_CONTEXT'], secrets: [],
    tools: ['k8s_list_pods', 'k8s_get_pod_logs', 'k8s_describe_pod', 'k8s_scale_deployment', 'k8s_restart_deployment', 'k8s_list_deployments', 'k8s_list_services', 'k8s_exec_command'],
    source: 'https://kubernetes.io/docs/reference/kubernetes-api/',
  },
  {
    name: 'datadog', description: 'Datadog observability — metrics, monitors, incidents, logs',
    protocol: 'REST', preset: ['DATADOG_SITE'], secrets: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
    tools: ['datadog_query_metrics', 'datadog_list_monitors', 'datadog_get_monitor', 'datadog_mute_monitor', 'datadog_list_incidents', 'datadog_search_logs', 'datadog_post_event'],
    source: 'https://docs.datadoghq.com/api/latest/',
  },
  {
    name: 'notion', description: 'Notion workspace integration via official API',
    protocol: 'REST', preset: [], secrets: ['NOTION_TOKEN'],
    tools: ['notion_search', 'notion_get_page', 'notion_create_page', 'notion_query_database', 'notion_update_page', 'notion_get_database'],
    source: 'https://developers.notion.com/reference/intro',
  },
  {
    name: 'linear', description: 'Linear project management integration',
    protocol: 'GraphQL', preset: [], secrets: ['LINEAR_API_KEY'],
    tools: ['linear_create_issue', 'linear_list_issues', 'linear_update_issue', 'linear_get_teams', 'linear_search_issues', 'linear_create_comment'],
    source: 'https://developers.linear.app/docs/graphql/working-with-the-graphql-api',
  },
  {
    name: 'mongodb', description: 'MongoDB memory — incident patterns, agent state',
    protocol: 'TCP', preset: ['MONGODB_URI'], secrets: [],
    tools: ['mongodb_recall_pattern', 'mongodb_store_pattern', 'mongodb_log_incident', 'mongodb_get_recent_incidents'],
    source: 'https://www.mongodb.com/docs/drivers/',
  },
]

const claudeConfig = `{
  "mcpServers": {
    "cybernetics": {
      "command": "cybernetics-mcp",
      "env": {
        "BROKER_API_KEY": "your-broker-key",
        "POSTGRES_DSN": "postgresql+asyncpg://user:pass@localhost/sentinel",
        "DYNATRACE_BASE_URL": "https://xyz.live.dynatrace.com",
        "DYNATRACE_API_TOKEN": "dt0c01.xxx"
      }
    }
  }
}`

const cursorConfig = `{
  "mcpServers": {
    "cybernetics": {
      "command": "cybernetics-mcp",
      "env": {
        "BROKER_API_KEY": "your-broker-key",
        "POSTGRES_DSN": "postgresql+asyncpg://user:pass@localhost/sentinel"
      }
    }
  }
}`

export function MCPPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="retro-window h-[calc(100vh-76px)] min-h-[680px] overflow-hidden">
      <div className="composer-toolbar flex min-h-[72px] items-center gap-4 border-b-2 border-[#676057] bg-[#09217f] px-6 text-white">
        <Server className="w-8 h-8 text-[#58ff3e]" />
        <span className="composer-title text-2xl font-black tracking-wide">MCP Control Plane</span>
        <div className="composer-toolbar-actions ml-auto flex items-center gap-2">
          <a href="#quick-start" className="retro-button toolbar-button"><Terminal className="w-6 h-6 text-[#071a7a]" />Quick Start</a>
          <a href="#adapter-catalog" className="retro-button toolbar-button"><Wrench className="w-6 h-6 text-[#071a7a]" />Adapters</a>
          <a href="#env-ref" className="retro-button toolbar-button"><Key className="w-6 h-6 text-[#071a7a]" />Env Vars</a>
        </div>
      </div>

      <div className="blueprint-grid h-[calc(100%-72px)] overflow-y-auto p-8 scrollbar-thin">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1fr_360px]">
          <section className="border-2 border-[#5d5850] bg-[#dedad3] p-7 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-4">
              <BookOpen className="mt-1 h-10 w-10 shrink-0 text-[#071a7a]" />
              <div>
                <h2 className="text-3xl font-black">Cybernetics MCP Server</h2>
                <p className="mt-2 text-lg font-bold">Connect your AI agents to the Cybernetics meta-broker.</p>
              </div>
            </div>
            <div className="my-6 border-t-2 border-dashed border-[#55504a]" />
            <p className="text-base font-semibold leading-relaxed">
              The Cybernetics MCP server is a single stdio-based MCP peer that aggregates all configured adapters into one unified tool namespace.
              Instead of installing 20 separate MCP servers, you install <strong>one</strong>. Your MCP client sees all tools from enabled adapters as a flat list.
            </p>
            <div className="mt-6 overflow-x-auto border-2 border-[#5d5850] bg-[#071122] p-4 font-mono text-sm text-[#d9e3f8]">
              <div className="flex min-w-max items-center gap-3">
                <span className="text-[#58ff3e]">Claude Desktop</span>
                <span className="text-[#7f8ba5]">-- stdio --</span>
                <span className="text-[#91b4ff]">Cybernetics MCP Server</span>
                <span className="text-[#7f8ba5]">-- tools --</span>
                <span className="text-[#ffd43b]">Dynatrace · GitHub · Slack · Browser</span>
              </div>
            </div>
          </section>

          <aside className="border-2 border-[#5d5850] bg-[#dedad3] p-6 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
            <h3 className="text-xl font-black">SYSTEM STATUS</h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ['Adapters', `${adapters.length}`],
                ['Tools', `${adapters.reduce((sum, a) => sum + a.tools.length, 0)}`],
                ['Protocol', 'MCP'],
                ['Mode', 'stdio'],
              ].map(([label, value]) => (
                <div key={label} className="border-2 border-[#8d877e] bg-[#eeeae4] p-3">
                  <div className="text-xs font-black tracking-wide text-[#071a7a]">{label}</div>
                  <div className="mt-1 text-2xl font-black">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t-2 border-[#8d877e] pt-5 text-sm font-bold leading-relaxed">
              Adapters only appear in client tool lists when their preset config and required secrets are available.
            </div>
          </aside>

          <section id="quick-start" className="space-y-5 border-2 border-[#5d5850] bg-[#dedad3] p-7 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)] xl:col-span-2">
            <h3 className="flex items-center gap-3 text-2xl font-black">
              <Terminal className="w-7 h-7 text-[#071a7a]" />
              Quick Start
            </h3>
            <div className="grid gap-5 lg:grid-cols-[0.75fr_1fr_1fr]">
              <div className="space-y-3">
                <p className="text-sm font-black">1. Install the package:</p>
                <div className="retro-code">
                  <div className="retro-code-head">
                    <span>bash</span>
                    <button onClick={() => copy('pip install cybernetics-mcp', 'pip')} title="Copy install command">
                      {copied === 'pip' ? <CheckCircle className="w-4 h-4 text-[#58ff3e]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre>pip install cybernetics-mcp</pre>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-black">2. Claude Desktop config:</p>
                <div className="retro-code">
                  <div className="retro-code-head">
                    <span>claude_desktop_config.json</span>
                    <button onClick={() => copy(claudeConfig, 'claude')} title="Copy Claude config">
                      {copied === 'claude' ? <CheckCircle className="w-4 h-4 text-[#58ff3e]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre>{claudeConfig}</pre>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-black">3. Cursor config:</p>
                <div className="retro-code">
                  <div className="retro-code-head">
                    <span>.cursor/mcp.json</span>
                    <button onClick={() => copy(cursorConfig, 'cursor')} title="Copy Cursor config">
                      {copied === 'cursor' ? <CheckCircle className="w-4 h-4 text-[#58ff3e]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre>{cursorConfig}</pre>
                </div>
              </div>
            </div>
          </section>

          <section id="adapter-catalog" className="space-y-5 border-2 border-[#5d5850] bg-[#dedad3] p-7 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)] xl:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-3 text-2xl font-black">
                  <Wrench className="w-7 h-7 text-[#071a7a]" />
                  Adapter Catalog
                </h3>
                <p className="mt-2 text-sm font-bold text-[#3c3934]">Preset config, required secrets, official sources, and exposed MCP tools.</p>
              </div>
              <div className="border-2 border-[#8d877e] bg-[#eeeae4] px-4 py-2 text-sm font-black">
                {adapters.length} adapters // {adapters.reduce((sum, a) => sum + a.tools.length, 0)} tools
              </div>
            </div>
            <div className="grid gap-3">
              {adapters.map((a) => (
                <div key={a.name} className="border-2 border-[#5d5850] bg-[#eeeae4]">
                  <button
                    onClick={() => toggleExpand(a.name)}
                    className="grid w-full grid-cols-[auto_minmax(110px,0.35fr)_1fr_auto_auto] items-center gap-3 px-4 py-3 text-left hover:bg-[#e5e0d8]"
                  >
                    <ChevronDown className={`w-5 h-5 text-[#071a7a] transition-transform ${expanded.has(a.name) ? 'rotate-180' : ''}`} />
                    <span className="text-base font-black capitalize text-[#071a7a]">{a.name}</span>
                    <span className="text-sm font-bold text-[#3c3934]">{a.description}</span>
                    <span className="border border-[#8d877e] px-2 py-1 text-xs font-black">{a.tools.length} tools</span>
                    {a.secrets.length > 0 ? (
                      <span className="border border-[#8d877e] bg-[#ffd31f] px-2 py-1 text-xs font-black">{a.secrets.length} keys</span>
                    ) : (
                      <span className="border border-[#8d877e] px-2 py-1 text-xs font-black">no keys</span>
                    )}
                  </button>
                  {expanded.has(a.name) && (
                    <div className="space-y-4 border-t-2 border-[#8d877e] p-4">
                      <a
                        href={a.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex border-2 border-[#8d877e] bg-[#d7e4ff] px-3 py-2 text-xs font-black text-[#071a7a] underline decoration-2 underline-offset-4"
                      >
                        Official Source
                      </a>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 text-xs font-black text-[#071a7a]">
                            <Settings className="w-4 h-4" /> Preset Connection Config
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {a.preset.length > 0 ? a.preset.map(p => (
                              <span key={p} className="retro-chip">{p}</span>
                            )) : <span className="text-xs font-bold text-[#5d5850]">No preset config required</span>}
                          </div>
                        </div>
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 text-xs font-black text-[#071a7a]">
                            <Key className="w-4 h-4" /> Secret Keys
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {a.secrets.length > 0 ? a.secrets.map(s => (
                              <span key={s} className="retro-chip retro-chip-key">{s}</span>
                            )) : <span className="text-xs font-bold text-[#5d5850]">None required</span>}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-xs font-black text-[#071a7a]">
                          <Wrench className="w-4 h-4" /> Tools
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {a.tools.map(t => (
                            <span key={t} className="retro-chip retro-chip-tool">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section id="env-ref" className="grid gap-6 xl:col-span-2 xl:grid-cols-2">
            <div className="border-2 border-[#5d5850] bg-[#dedad3] p-7 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
              <h3 className="mb-4 flex items-center gap-3 text-2xl font-black">
                <Settings className="w-7 h-7 text-[#071a7a]" />
                Preset Config
              </h3>
              <div className="grid gap-2">
                {['POSTGRES_DSN', 'MONGODB_URI', 'DYNATRACE_BASE_URL', 'ELASTIC_CLOUD_ID', 'GITLAB_URL', 'ARIZE_ENDPOINT', 'DATADOG_SITE', 'BROWSER_CDP_HOST', 'BROWSER_CDP_PORT', 'SUPABASE_URL', 'CLOUDFLARE_ACCOUNT_ID', 'AWS_REGION', 'KUBERNETES_NAMESPACE', 'KUBECONFIG_CONTEXT'].map(v => (
                  <div key={v} className="flex items-center gap-3 border-2 border-[#8d877e] bg-[#eeeae4] px-3 py-2">
                    <span className="text-xs font-black text-[#071a7a]">URL</span>
                    <span className="font-mono text-xs font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-2 border-[#5d5850] bg-[#dedad3] p-7 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
              <h3 className="mb-4 flex items-center gap-3 text-2xl font-black">
                <Key className="w-7 h-7 text-[#071a7a]" />
                Secret Keys
              </h3>
              <div className="grid gap-2">
                {['BROKER_API_KEY', 'DYNATRACE_API_TOKEN', 'ELASTIC_API_KEY', 'GITLAB_TOKEN', 'GITHUB_TOKEN', 'SLACK_BOT_TOKEN', 'DATADOG_API_KEY', 'DATADOG_APP_KEY', 'NOTION_TOKEN', 'LINEAR_API_KEY', 'STRIPE_API_KEY', 'FIVETRAN_API_KEY', 'FIVETRAN_API_SECRET', 'VERCEL_TOKEN', 'CLOUDFLARE_API_TOKEN', 'SUPABASE_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].map(v => (
                  <div key={v} className="flex items-center gap-3 border-2 border-[#8d877e] bg-[#eeeae4] px-3 py-2">
                    <span className="text-xs font-black text-[#071a7a]">KEY</span>
                    <span className="font-mono text-xs font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="border-2 border-[#5d5850] bg-[#dedad3] p-7 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)] xl:col-span-2">
            <h3 className="mb-4 flex items-center gap-3 text-2xl font-black">
              <AlertCircle className="w-7 h-7 text-[#071a7a]" />
              Troubleshooting
            </h3>
            <div className="grid gap-3 text-sm font-bold md:grid-cols-2">
              <p className="border-2 border-[#8d877e] bg-[#eeeae4] p-4"><strong>tools/list is empty?</strong> Check that adapter env vars are set.</p>
              <p className="border-2 border-[#8d877e] bg-[#eeeae4] p-4"><strong>Connection refused?</strong> Ensure the Cybernetics broker is running.</p>
              <p className="border-2 border-[#8d877e] bg-[#eeeae4] p-4"><strong>Auth errors?</strong> Verify <code>BROKER_API_KEY</code> matches the broker key.</p>
              <p className="border-2 border-[#8d877e] bg-[#eeeae4] p-4"><strong>Missing adapter?</strong> Preset config must exist before adapters register.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
