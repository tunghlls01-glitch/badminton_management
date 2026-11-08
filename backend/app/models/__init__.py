# Import mọi model ở đây để Base.metadata.create_all() "nhìn thấy" và tạo bảng.
# Thêm model mới -> nhớ thêm 1 dòng import vào file này.
from app.models.invoice import Invoice  # noqa: F401
from app.models.item import Item  # noqa: F401
from app.models.payment import Payment, PaymentMethod, PaymentStatus  # noqa: F401
from app.models.service import Service, ServiceCategory, ServiceStatus  # noqa: F401
from app.models.service_order import ServiceOrder, ServiceOrderStatus  # noqa: F401
from app.models.service_order_item import ServiceOrderItem  # noqa: F401
from app.models.service_stock_log import ServiceStockLog, StockChangeType  # noqa: F401
from app.models.user import User, UserRole, UserStatus  # noqa: F401
