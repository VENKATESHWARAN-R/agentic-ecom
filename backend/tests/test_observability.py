"""Tests for the observability wiring (P7). The real value (traces, the §19 metrics)
shows up in Logfire; here we just protect the wiring: configuration is idempotent,
metric counting never raises, and the security audit loggers are routed to Logfire."""

import logging

import logfire

from voltti_backend import observability


def test_configure_is_idempotent():
    from fastapi import FastAPI

    app = FastAPI()
    observability.configure(app)
    observability.configure(app)  # second call is a no-op, must not raise


def test_count_never_raises():
    # Observability must never affect a request, even before configure / on error.
    observability.count("voltti.test.metric")
    observability.count("voltti.test.metric")


def test_audit_loggers_route_to_logfire():
    # configure() attaches a Logfire handler to the voltti.* namespace so security
    # audit logs (tool-gateway, guard, output-validation, authz) are surfaced.
    handlers = logging.getLogger("voltti").handlers
    assert any(isinstance(h, logfire.LogfireLoggingHandler) for h in handlers)
