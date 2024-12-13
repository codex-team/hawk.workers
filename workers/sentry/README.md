# Worker / Sentry

Sentry worker for handling events in correct format.

## How to run

1. Make sure you are in Workers root directory
3. `yarn install`
4. `yarn run-sentry`

## Sentry message

### SentryEventWorkerTask
```
{"projectId":"675c9605b8264d74b5a7dcf3","payload":{"envelope":"<...Base64EncodedEnvelope..."},"catcherType":"sentry"}
```

### SentryEnvelope
Keep attention that SentryEnvelope includes SentryItem JSONs separated by `\n`. SentryEnvelope is not a valid JSON.
```
{
    "event_id": "b0e3acd49441406eba0dca675eda7d0c",
    "sent_at": "2024-12-13T20:17:37.881457Z",
    "trace": {
        "trace_id": "d5fa1c37487c435494cc6a8291498ea0",
        "environment": "production",
        "release": "10baa89ba2e01bcbfe6a84b24d4e49a4b971ac80",
        "public_key": "..."
    }
}
{
    "type": "event",
    "content_type": "application/json",
    "length": 1994
}
{
    "level": "error",
    "exception": {
        "values": [
            {
                "mechanism": {
                    "type": "excepthook",
                    "handled": false
                },
                "module": null,
                "type": "ZeroDivisionError",
                "value": "division by zero",
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "sentry-prod.py",
                            "abs_path": "/Users/nostr/dev/codex/hawk.mono/tests/manual/sentry/sentry-prod.py",
                            "function": "<module>",
                            "module": "__main__",
                            "lineno": 10,
                            "pre_context": [
                                "",
                                "sentry_sdk.init(",
                                "    dsn=f\"https://{HAWK_INTEGRATION_TOKEN}@k1.hawk.so/0\",",
                                "    debug=True",
                                ")"
                            ],
                            "context_line": "division_by_zero = 1 / 0",
                            "post_context": [
                                "print(\"this\")",
                                "print(\"is\")",
                                "print(\"ok\")",
                                "# raise Exception(\"This is a test exception\")"
                            ],
                            "vars": {
                                "__name__": "'__main__'",
                                "__doc__": "None",
                                "__package__": "None",
                                "__loader__": "<_frozen_importlib_external.SourceFileLoader object at 0x102ce9020>",
                                "__spec__": "None",
                                "__annotations__": {},
                                "__builtins__": "<module 'builtins' (built-in)>",
                                "__file__": "'/Users/nostr/dev/codex/hawk.mono/tests/manual/sentry/sentry-prod.py'",
                                "__cached__": "None",
                                "sentry_sdk": "<module 'sentry_sdk' from '/Users/nostr/dev/codex/hawk.mono/.venv/lib/python3.13/site-packages/sentry_sdk/__init__.py'>"
                            },
                            "in_app": true
                        }
                    ]
                }
            }
        ]
    },
    "event_id": "b0e3acd49441406eba0dca675eda7d0c",
    "timestamp": "2024-12-13T20:17:37.875833Z",
    "contexts": {
        "trace": {
            "trace_id": "d5fa1c37487c435494cc6a8291498ea0",
            "span_id": "87806baddaae13c2",
            "parent_span_id": null
        },
        "runtime": {
            "name": "CPython",
            "version": "3.13.0",
            "build": "3.13.0 (main, Oct  7 2024, 05:02:14) [Clang 16.0.0 (clang-1600.0.26.3)]"
        }
    },
    "transaction_info": {},
    "breadcrumbs": {
        "values": []
    },
    "extra": {
        "sys.argv": [
            "sentry-prod.py"
        ]
    },
    "modules": {
        "pip": "24.3.1",
        "urllib3": "2.2.3",
        "sentry-sdk": "2.19.0",
        "certifi": "2024.8.30"
    },
    "release": "10baa89ba2e01bcbfe6a84b24d4e49a4b971ac80",
    "environment": "production",
    "server_name": "MacBook-Pro-Aleksandr-5.local",
    "sdk": {
        "name": "sentry.python",
        "version": "2.19.0",
        "packages": [
            {
                "name": "pypi:sentry-sdk",
                "version": "2.19.0"
            }
        ],
        "integrations": [
            "argv",
            "atexit",
            "dedupe",
            "excepthook",
            "logging",
            "modules",
            "stdlib",
            "threading"
        ]
    },
    "platform": "python"
}
```