"""SQLModel tables. Products and users are static seed data (re-seeded on every
startup from data/*.json); orders are the runtime data this backend owns —
seeded demo history is regenerated with fresh relative dates on startup, while
orders placed through the API persist across restarts.
"""

from typing import Any, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ProductRow(SQLModel, table=True):
    __tablename__ = "products"

    id: str = Field(primary_key=True)
    position: int = Field(index=True)  # catalog order matters for deterministic sorts
    data: dict[str, Any] = Field(sa_column=Column(JSON))


class UserRow(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(primary_key=True)
    data: dict[str, Any] = Field(sa_column=Column(JSON))


class OrderRow(SQLModel, table=True):
    __tablename__ = "orders"

    number: str = Field(primary_key=True)
    user_id: str = Field(index=True)
    lines: list[dict[str, Any]] = Field(sa_column=Column(JSON))
    total: float
    details: dict[str, Any] = Field(sa_column=Column(JSON))
    placed_at: str  # ISO timestamp
    status: str  # processing | shipped | delivered
    delivered_at: Optional[str] = None
    seed: bool = Field(default=False, index=True)

    def to_order(self) -> dict[str, Any]:
        """The Order shape used by the domain layer and API (camelCase)."""
        order: dict[str, Any] = {
            "number": self.number,
            "userId": self.user_id,
            "lines": self.lines,
            "total": self.total,
            "details": self.details,
            "placedAt": self.placed_at,
            "status": self.status,
        }
        if self.delivered_at is not None:
            order["deliveredAt"] = self.delivered_at
        return order
