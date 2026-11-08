# Import mọi model ở đây để Base.metadata.create_all() "nhìn thấy" và tạo bảng.
from app.models.item import Item  # noqa: F401
from app.models.user import User, UserRole, UserStatus  # noqa: F401
from app.models.court import (  # noqa: F401
    Court,
    CourtBlock,
    CourtBlockStatus,
    CourtStatus,
    PriceRule,
    PriceRuleStatus,
)
from app.models.booking import (  # noqa: F401
    Booking,
    BookingChannel,
    BookingSlot,
    BookingSlotStatus,
    BookingStatus,
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from app.models.service import (  # noqa: F401
    Service,
    ServiceOrder,
    ServiceOrderItem,
    ServiceOrderStatus,
    ServiceStatus,
    ServiceStockLog,
    StockChangeType,
)
