"""Typed configuration with pydantic-settings. No unconditional load_dotenv."""

from pydantic import Field, field_validator, ConfigDict
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """All configuration loaded from environment or GCP Secret Manager."""

    model_config = ConfigDict(
        env_file=None,  # Disabled — secrets come from Cloud Run / Secret Manager
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Broker (required in production)
    broker_api_key: str = Field("test-key", alias="BROKER_API_KEY")
    broker_port: int = Field(8080, alias="BROKER_PORT")
    broker_host: str = Field("0.0.0.0", alias="BROKER_HOST")
    log_level: str = Field("INFO", alias="LOG_LEVEL")
    environment: str = Field("production", alias="ENVIRONMENT")

    # Google Cloud / Gemini
    google_cloud_project: str = Field("", alias="GOOGLE_CLOUD_PROJECT")
    google_cloud_location: str = Field("us-central1", alias="GOOGLE_CLOUD_LOCATION")
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")

    # Dynatrace
    dynatrace_base_url: str = Field("", alias="DYNATRACE_BASE_URL")
    dynatrace_api_token: str = Field("", alias="DYNATRACE_API_TOKEN")

    # Elastic
    elastic_cloud_id: str = Field("", alias="ELASTIC_CLOUD_ID")
    elastic_api_key: str = Field("", alias="ELASTIC_API_KEY")

    # Postgres (replaces MongoDB)
    postgres_dsn: str = Field("postgresql+asyncpg://localhost/test", alias="POSTGRES_DSN")

    # GitLab
    gitlab_url: str = Field("https://gitlab.com", alias="GITLAB_URL")
    gitlab_token: str = Field("", alias="GITLAB_TOKEN")
    gitlab_project_id: str = Field("", alias="GITLAB_PROJECT_ID")

    # Arize
    arize_api_key: str = Field("", alias="ARIZE_API_KEY")
    arize_endpoint: str = Field("https://app.phoenix.arize.com", alias="ARIZE_ENDPOINT")

    # Fivetran
    fivetran_api_key: str = Field("", alias="FIVETRAN_API_KEY")
    fivetran_api_secret: str = Field("", alias="FIVETRAN_API_SECRET")

    # GitHub
    github_token: str = Field("", alias="GITHUB_TOKEN")
    github_api_url: str = Field("https://api.github.com", alias="GITHUB_API_URL")

    # Stripe
    stripe_api_key: str = Field("", alias="STRIPE_API_KEY")

    # AWS
    aws_access_key_id: str = Field("", alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field("", alias="AWS_SECRET_ACCESS_KEY")
    aws_region: str = Field("us-east-1", alias="AWS_REGION")

    # Vercel
    vercel_token: str = Field("", alias="VERCEL_TOKEN")

    # Supabase
    supabase_url: str = Field("", alias="SUPABASE_URL")
    supabase_key: str = Field("", alias="SUPABASE_KEY")

    # Cloudflare
    cloudflare_api_token: str = Field("", alias="CLOUDFLARE_API_TOKEN")
    cloudflare_account_id: str = Field("", alias="CLOUDFLARE_ACCOUNT_ID")

    # Datadog
    datadog_api_key: str = Field("", alias="DATADOG_API_KEY")
    datadog_app_key: str = Field("", alias="DATADOG_APP_KEY")
    datadog_site: str = Field("datadoghq.com", alias="DATADOG_SITE")

    # Kubernetes
    kubeconfig_context: str = Field("", alias="KUBECONFIG_CONTEXT")
    kubernetes_namespace: str = Field("default", alias="KUBERNETES_NAMESPACE")
    kubernetes_service_host: str = Field("", alias="KUBERNETES_SERVICE_HOST")

    # Slack
    slack_bot_token: str = Field("", alias="SLACK_BOT_TOKEN")

    # Notion
    notion_token: str = Field("", alias="NOTION_TOKEN")

    # Linear
    linear_api_key: str = Field("", alias="LINEAR_API_KEY")

    # Airtable
    airtable_api_key: str = Field("", alias="AIRTABLE_API_KEY")
    airtable_base_id: str = Field("", alias="AIRTABLE_BASE_ID")

    # Asana
    asana_token: str = Field("", alias="ASANA_TOKEN")

    # Google Workspace (shared service account)
    google_service_account_key: str = Field("", alias="GOOGLE_SERVICE_ACCOUNT_KEY")
    google_service_account_path: str = Field("", alias="GOOGLE_SERVICE_ACCOUNT_PATH")
    google_maps_api_key: str = Field("", alias="GOOGLE_MAPS_API_KEY")

    # Confluence
    confluence_url: str = Field("", alias="CONFLUENCE_URL")
    confluence_api_token: str = Field("", alias="CONFLUENCE_API_TOKEN")

    # Docker
    docker_host: str = Field("unix:///var/run/docker.sock", alias="DOCKER_HOST")

    # Jira
    jira_url: str = Field("", alias="JIRA_URL")
    jira_api_token: str = Field("", alias="JIRA_API_TOKEN")
    jira_user_email: str = Field("", alias="JIRA_USER_EMAIL")

    # n8n
    n8n_api_key: str = Field("", alias="N8N_API_KEY")
    n8n_url: str = Field("", alias="N8N_URL")

    # PagerDuty
    pagerduty_api_key: str = Field("", alias="PAGERDUTY_API_KEY")

    # Redis
    redis_url: str = Field("redis://localhost:6379", alias="REDIS_URL")

    # QuickBooks
    quickbooks_access_token: str = Field("", alias="QUICKBOOKS_ACCESS_TOKEN")
    quickbooks_company_id: str = Field("", alias="QUICKBOOKS_COMPANY_ID")
    quickbooks_sandbox: bool = Field(False, alias="QUICKBOOKS_SANDBOX")

    # Shopify
    shopify_access_token: str = Field("", alias="SHOPIFY_ACCESS_TOKEN")
    shopify_shop_domain: str = Field("", alias="SHOPIFY_SHOP_DOMAIN")

    # Snowflake
    snowflake_account: str = Field("", alias="SNOWFLAKE_ACCOUNT")
    snowflake_user: str = Field("", alias="SNOWFLAKE_USER")
    snowflake_password: str = Field("", alias="SNOWFLAKE_PASSWORD")

    # MongoDB (existing file, missing config)
    mongodb_uri: str = Field("mongodb://localhost:27017", alias="MONGODB_URI")

    # Browser DevTools (CDP)
    browser_cdp_host: str = Field("localhost", alias="BROWSER_CDP_HOST")
    browser_cdp_port: int = Field(9222, alias="BROWSER_CDP_PORT")

    # Circuit breaker defaults
    circuit_failure_threshold: int = Field(5, alias="CIRCUIT_FAILURE_THRESHOLD")
    circuit_recovery_timeout: int = Field(60, alias="CIRCUIT_RECOVERY_TIMEOUT")

    # Sentinel features
    sentinels_enabled: List[str] = Field(default_factory=lambda: ["audit"])

    @field_validator("broker_api_key", "postgres_dsn")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v:
            raise ValueError(f"{cls.__name__} field must not be empty")
        return v


# Singleton settings instance — dependency injection target
settings = Settings()
