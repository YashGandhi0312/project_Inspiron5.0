"""
NPI Validator — Luhn check + CMS NPPES Registry API lookup.
"""

from __future__ import annotations
import httpx


def luhn_check_npi(npi: str) -> bool:
    """
    Validate NPI using Luhn algorithm with the 80840 prefix.
    """
    if not npi or not npi.isdigit() or len(npi) != 10:
        return False

    prefixed = "80840" + npi
    digits = [int(d) for d in prefixed]
    checksum = 0
    is_odd = True

    for i in range(len(digits) - 2, -1, -1):
        d = digits[i]
        if is_odd:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
        is_odd = not is_odd

    return (checksum + digits[-1]) % 10 == 0


async def lookup_npi(npi: str) -> dict:
    """
    Look up an NPI on the CMS NPPES registry API.
    Returns provider details or error info.
    """
    result = {
        "npi": npi,
        "valid_format": luhn_check_npi(npi),
        "found": False,
        "provider": None,
        "error": None,
    }

    if not result["valid_format"]:
        result["error"] = "NPI fails Luhn check — invalid format"
        return result

    try:
        url = f"https://npiregistry.cms.hhs.gov/api/?number={npi}&version=2.1"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            data = response.json()

        if data.get("result_count", 0) > 0:
            provider = data["results"][0]
            basic = provider.get("basic", {})
            result["found"] = True
            result["provider"] = {
                "name": f"{basic.get('first_name', '')} {basic.get('last_name', '')}".strip()
                        or basic.get("organization_name", ""),
                "entity_type": basic.get("enumeration_type", ""),
                "status": basic.get("status", ""),
                "enumeration_date": basic.get("enumeration_date", ""),
                "last_updated": basic.get("last_updated", ""),
                "credential": basic.get("credential", ""),
                "taxonomy": "",
            }
            # Get primary taxonomy
            taxonomies = provider.get("taxonomies", [])
            for tax in taxonomies:
                if tax.get("primary", False):
                    result["provider"]["taxonomy"] = (
                        f"{tax.get('code', '')} — {tax.get('desc', '')}"
                    )
                    break
        else:
            result["error"] = "NPI not found in NPPES registry"

    except httpx.TimeoutException:
        result["error"] = "NPPES API timeout — try again later"
    except Exception as e:
        result["error"] = f"NPPES API error: {str(e)}"

    return result
