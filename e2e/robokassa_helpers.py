import hashlib
import os

ROBOKASSA_PASSWORD_2 = os.environ.get("ROBOKASSA_PASSWORD_2", "test-password-2")


def robokassa_result_signature(
    out_sum: str,
    inv_id: int | str,
    password2: str | None = None,
    shp: dict | None = None,
) -> str:
    pwd = password2 or ROBOKASSA_PASSWORD_2
    base = f"{out_sum}:{inv_id}:{pwd}"
    if shp:
        for key in sorted(shp.keys(), key=lambda k: k.lower()):
            base += f":{key}={shp[key]}"
    return hashlib.md5(base.encode()).hexdigest()


def robokassa_result_url(base_url: str, inv_id: int, out_sum: str) -> str:
    sig = robokassa_result_signature(out_sum, inv_id)
    return f"{base_url}/api/webhook/robokassa/result?OutSum={out_sum}&InvId={inv_id}&SignatureValue={sig}"
