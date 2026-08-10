import os

SECRET_KEY = os.environ["SUPERSET_SECRET_KEY"]
SQLALCHEMY_DATABASE_URI = "sqlite:////var/lib/chimpmaera-bi/superset.db"
WTF_CSRF_ENABLED = True
PUBLIC_ROLE_LIKE = None
AUTH_ROLE_PUBLIC = "Public"  # required FAB role; it is not copied from any data role
ENABLE_PROXY_FIX = False
TALISMAN_ENABLED = False  # localhost HTTP only; never a public/production deployment
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": False,
    "ALERT_REPORTS": False,
    "EMBEDDED_SUPERSET": False,
}
SQLLAB_CTAS_NO_LIMIT = False
SQL_MAX_ROW = 1000
UPLOAD_FOLDER = "/var/lib/chimpmaera-bi/uploads-denied"
ALLOWED_EXTENSIONS = set()
PREVENT_UNSAFE_DB_CONNECTIONS = True
WTF_CSRF_EXEMPT_LIST = []
