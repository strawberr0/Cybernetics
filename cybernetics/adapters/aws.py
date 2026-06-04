"""AWS adapter — S3, EC2, Lambda, CloudWatch via boto3."""

import boto3
from typing import Dict, Any, List, Optional
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger
import asyncio

logger = get_logger("cybernetics.adapters.aws")


class AWSAdapter(MCPAdapter):
    name = "aws"
    description = "AWS — S3, EC2, Lambda, CloudWatch"

    def __init__(self):
        super().__init__()
        self.session = boto3.Session(
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )
        self.register_tool("aws_s3_list_buckets", "List S3 buckets", {}, [], self._s3_list_buckets)
        self.register_tool("aws_s3_list_objects", "List objects in a bucket prefix", {"bucket": {"type": "string"}, "prefix": {"type": "string"}, "max_keys": {"type": "integer"}}, ["bucket"], self._s3_list_objects)
        self.register_tool("aws_ec2_describe_instances", "Describe EC2 instances", {"filters": {"type": "object"}}, [], self._ec2_describe)
        self.register_tool("aws_lambda_list_functions", "List Lambda functions", {"max_items": {"type": "integer"}}, [], self._lambda_list)
        self.register_tool("aws_lambda_invoke", "Invoke a Lambda function", {"function_name": {"type": "string"}, "payload": {"type": "object"}}, ["function_name"], self._lambda_invoke)
        self.register_tool("aws_cloudwatch_get_metrics", "Get CloudWatch metrics", {"namespace": {"type": "string"}, "metric_name": {"type": "string"}, "dimensions": {"type": "object"}, "period": {"type": "integer"}}, ["namespace", "metric_name"], self._cloudwatch_metrics)

    def _run_sync(self, fn, *args, **kwargs):
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_in_executor(None, fn, *args, **kwargs)

    @circuit("aws", failure_threshold=5, recovery_timeout=60)
    async def _s3_list_buckets(self) -> List[Dict[str, Any]]:
        s3 = self.session.client("s3")
        resp = await self._run_sync(s3.list_buckets)
        return resp.get("Buckets", [])

    @circuit("aws", failure_threshold=5, recovery_timeout=60)
    async def _s3_list_objects(self, bucket: str, prefix: str = "", max_keys: int = 100) -> List[Dict[str, Any]]:
        s3 = self.session.client("s3")
        resp = await self._run_sync(s3.list_objects_v2, Bucket=bucket, Prefix=prefix, MaxKeys=max_keys)
        return resp.get("Contents", [])

    @circuit("aws", failure_threshold=5, recovery_timeout=60)
    async def _ec2_describe(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        ec2 = self.session.client("ec2")
        kwargs = {}
        if filters:
            kwargs["Filters"] = [{"Name": k, "Values": v if isinstance(v, list) else [v]} for k, v in filters.items()]
        resp = await self._run_sync(ec2.describe_instances, **kwargs)
        instances = []
        for r in resp.get("Reservations", []):
            instances.extend(r.get("Instances", []))
        return instances

    @circuit("aws", failure_threshold=5, recovery_timeout=60)
    async def _lambda_list(self, max_items: int = 50) -> List[Dict[str, Any]]:
        lam = self.session.client("lambda")
        resp = await self._run_sync(lam.list_functions, MaxItems=max_items)
        return resp.get("Functions", [])

    @circuit("aws", failure_threshold=5, recovery_timeout=60)
    async def _lambda_invoke(self, function_name: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        import json
        lam = self.session.client("lambda")
        resp = await self._run_sync(lam.invoke, FunctionName=function_name, Payload=json.dumps(payload or {}))
        return {"status_code": resp["StatusCode"], "payload": resp["Payload"].read().decode("utf-8")}

    @circuit("aws", failure_threshold=5, recovery_timeout=60)
    async def _cloudwatch_metrics(self, namespace: str, metric_name: str, dimensions: Optional[Dict[str, str]] = None, period: int = 300) -> List[Dict[str, Any]]:
        from datetime import datetime, timedelta, timezone
        cw = self.session.client("cloudwatch")
        dim_list = [{"Name": k, "Value": v} for k, v in (dimensions or {}).items()]
        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=1)
        resp = await self._run_sync(cw.get_metric_statistics, Namespace=namespace, MetricName=metric_name, Dimensions=dim_list, StartTime=start, EndTime=end, Period=period, Statistics=["Average"])
        return resp.get("Datapoints", [])

    async def health(self) -> Dict[str, Any]:
        try:
            sts = self.session.client("sts")
            identity = await self._run_sync(sts.get_caller_identity)
            return {"status": "healthy", "account": identity.get("Account")}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
