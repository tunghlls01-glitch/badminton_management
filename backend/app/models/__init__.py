# Import mọi model ở đây để Base.metadata.create_all() "nhìn thấy" và tạo bảng.
# Thêm model mới -> nhớ thêm dòng import vào file này.
from app.models.item import Item  # noqa: F401
from app.models.service import Service, ServiceCategory, ServiceStatus  # noqa: F401
from app.models.service_order import ServiceOrder, ServiceOrderStatus  # noqa: F401
from app.models.service_order_item import ServiceOrderItem  # noqa: F401
from app.models.service_stock_log import ServiceStockLog, StockChangeType  # noqa: F401
