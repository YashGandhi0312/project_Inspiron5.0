"""
HIPAA 5010 Validation Rule Engine.

Declarative JSON-based rules + programmatic checks for X12 EDI validation.
"""

from __future__ import annotations
import re
from parser.edi_types import (
    ParseResult, Segment, ValidationError, ValidationResult,
)


# ── CARC / RARC code descriptions ──────────────────────────────────────

CARC_CODES = {
    "1": "Deductible amount",
    "2": "Coinsurance amount",
    "3": "Co-payment amount",
    "4": "The procedure code is inconsistent with the modifier used",
    "5": "The procedure code/type of bill is inconsistent with the place of service",
    "16": "Claim/service lacks information or has submission/billing error(s)",
    "18": "Exact duplicate claim/service",
    "22": "This care may be covered by another payer per coordination of benefits",
    "23": "The impact of prior payer(s) adjudication including payments and/or adjustments",
    "29": "The time limit for filing has expired",
    "45": "Charge exceeds fee schedule/maximum allowable",
    "50": "These are non-covered services because this is not deemed a medical necessity",
    "96": "Non-covered charge(s)",
    "97": "The benefit for this service is included in the payment/allowance for another service",
    "109": "Claim/service not covered by this payer/contractor",
    "119": "Benefit maximum for this time period or occurrence has been reached",
    "197": "Precertification/authorization/notification absent",
    "204": "This service/equipment/drug is not covered under the patient's current benefit plan",
    "253": "Sequestration - Loss reduction of federal payment",
}

RARC_CODES = {
    "N1": "Alert: You may appeal this decision.",
    "N19": "Procedure code incidental to primary procedure.",
    "N30": "Patient ineligible for this service.",
    "N362": "Missing/incomplete/invalid medication name.",
    "N386": "This decision was based on a National Coverage Determination (NCD).",
    "N432": "Alert: Adjustment based on recovery audit.",
    "MA04": "Secondary payment cannot be calculated without the primary payer's EOB.",
    "MA130": "Claim submitted to incorrect payer.",
}


# ── Luhn check for NPI ─────────────────────────────────────────────────

def luhn_check(number: str) -> bool:
    """Validate NPI using Luhn algorithm (with 80840 prefix)."""
    if not number or not number.isdigit() or len(number) != 10:
        return False

    # Prefix with 80840 for NPI Luhn validation
    prefixed = "80840" + number
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

    total = (checksum + digits[-1]) % 10
    return total == 0


def validate_date(value: str) -> bool:
    """Validate date format CCYYMMDD."""
    if not value or len(value) != 8 or not value.isdigit():
        return False
    year = int(value[:4])
    month = int(value[4:6])
    day = int(value[6:8])
    return 1900 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31


def validate_zip(value: str) -> bool:
    """Validate US ZIP code (5 or 9 digits)."""
    cleaned = value.replace("-", "")
    return bool(re.match(r'^\d{5}(\d{4})?$', cleaned))


def validate_state(value: str) -> bool:
    """Validate US state code."""
    states = {
        "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
        "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
        "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
        "TX","UT","VT","VA","WA","WV","WI","WY","DC","PR","VI","GU","AS","MP",
    }
    return value.strip().upper() in states


# ── Core validation rules ──────────────────────────────────────────────

def validate_envelope(segments: list[Segment], errors: list[ValidationError]):
    """Validate ISA/IEA/GS/GE/ST/SE envelope integrity."""
    seg_ids = [s.segment_id for s in segments]

    # Must start with ISA
    if not seg_ids or seg_ids[0] != "ISA":
        errors.append(ValidationError(
            error_id="ENV001",
            severity="error",
            segment_id="ISA",
            message="File must begin with ISA (Interchange Control Header) segment",
            suggestion="Add ISA segment at the beginning of the file",
        ))
        return

    # Must end with IEA
    if seg_ids[-1] != "IEA":
        errors.append(ValidationError(
            error_id="ENV002",
            severity="error",
            segment_id="IEA",
            message="File must end with IEA (Interchange Control Trailer) segment",
            suggestion="Add IEA segment at the end of the file",
        ))

    # ISA must have 16 elements
    isa = segments[0]
    if len(isa.elements) < 16:
        errors.append(ValidationError(
            error_id="ENV003",
            severity="error",
            segment_id="ISA",
            element_index=0,
            line_number=isa.line_number,
            message=f"ISA segment must have 16 elements, found {len(isa.elements)}",
            suggestion="Ensure ISA segment contains all 16 required elements",
            fixable=False,
        ))

    # Check ISA05 and ISA07 (qualifier codes)
    if len(isa.elements) >= 7:
        valid_qualifiers = {"01", "14", "20", "27", "28", "29", "30", "33", "ZZ"}
        isa05 = isa.elements[4].value.strip()
        isa07 = isa.elements[6].value.strip()
        if isa05 not in valid_qualifiers:
            errors.append(ValidationError(
                error_id="ENV004",
                severity="error",
                segment_id="ISA",
                element_index=5,
                line_number=isa.line_number,
                message=f"ISA05 (Sender ID Qualifier) '{isa05}' is not a valid qualifier",
                suggestion=f"Use one of: {', '.join(sorted(valid_qualifiers))}",
                fixable=True,
                fix_value="ZZ",
            ))
        if isa07 not in valid_qualifiers:
            errors.append(ValidationError(
                error_id="ENV005",
                severity="error",
                segment_id="ISA",
                element_index=7,
                line_number=isa.line_number,
                message=f"ISA07 (Receiver ID Qualifier) '{isa07}' is not a valid qualifier",
                suggestion=f"Use one of: {', '.join(sorted(valid_qualifiers))}",
                fixable=True,
                fix_value="ZZ",
            ))

    # Check GS/GE pair
    gs_count = seg_ids.count("GS")
    ge_count = seg_ids.count("GE")
    if gs_count != ge_count:
        errors.append(ValidationError(
            error_id="ENV006",
            severity="error",
            segment_id="GS/GE",
            message=f"Mismatched GS/GE count: {gs_count} GS vs {ge_count} GE",
            suggestion="Ensure each GS has a matching GE segment",
        ))

    # Check ST/SE pair
    st_count = seg_ids.count("ST")
    se_count = seg_ids.count("SE")
    if st_count != se_count:
        errors.append(ValidationError(
            error_id="ENV007",
            severity="error",
            segment_id="ST/SE",
            message=f"Mismatched ST/SE count: {st_count} ST vs {se_count} SE",
            suggestion="Ensure each ST has a matching SE segment",
        ))


def validate_837p(segments: list[Segment], errors: list[ValidationError]):
    """837P-specific validation rules."""
    has_clm = False
    has_billing_provider = False
    has_subscriber = False

    for seg in segments:
        if seg.segment_id == "CLM":
            has_clm = True
            # CLM02 (total charge) must be numeric
            if len(seg.elements) >= 2:
                try:
                    float(seg.elements[1].value)
                except ValueError:
                    errors.append(ValidationError(
                        error_id="837P001",
                        severity="error",
                        segment_id="CLM",
                        element_index=2,
                        line_number=seg.line_number,
                        message=f"CLM02 (Total Claim Charge) '{seg.elements[1].value}' is not a valid amount",
                        suggestion="Enter a valid numeric amount",
                        fixable=True,
                        fix_value="0.00",
                    ))
            # CLM05 (place of service) required
            if len(seg.elements) >= 5:
                clm05 = seg.elements[4].value.strip()
                if not clm05:
                    errors.append(ValidationError(
                        error_id="837P002",
                        severity="error",
                        segment_id="CLM",
                        element_index=5,
                        line_number=seg.line_number,
                        message="CLM05 (Facility Code) is required",
                        suggestion="Add the place of service/facility type code",
                    ))

        elif seg.segment_id == "NM1":
            if len(seg.elements) >= 1:
                qualifier = seg.elements[0].value.strip()
                if qualifier == "85":
                    has_billing_provider = True
                    # Check NPI in NM109
                    if len(seg.elements) >= 9:
                        npi = seg.elements[8].value.strip()
                        if npi and not luhn_check(npi):
                            errors.append(ValidationError(
                                error_id="837P003",
                                severity="error",
                                segment_id="NM1",
                                element_index=9,
                                loop_location="2010AA",
                                line_number=seg.line_number,
                                message=f"Billing Provider NPI '{npi}' fails Luhn check",
                                suggestion="Verify and correct the NPI number",
                                fixable=False,
                            ))
                elif qualifier == "IL":
                    has_subscriber = True

        elif seg.segment_id == "SV1":
            # SV101 - procedure code required
            if len(seg.elements) >= 1:
                sv101 = seg.elements[0].value.strip()
                if not sv101:
                    errors.append(ValidationError(
                        error_id="837P004",
                        severity="error",
                        segment_id="SV1",
                        element_index=1,
                        loop_location="2400",
                        line_number=seg.line_number,
                        message="SV101 (Procedure Code) is required",
                        suggestion="Add the CPT/HCPCS procedure code",
                    ))

        elif seg.segment_id == "HI":
            # Diagnosis codes
            if len(seg.elements) >= 1:
                hi_code = seg.elements[0].value.strip()
                if hi_code and ":" in hi_code:
                    qualifier, code = hi_code.split(":", 1)
                    if qualifier.upper() not in ("ABK", "ABF", "BK", "BF", "ABJ", "ABN"):
                        errors.append(ValidationError(
                            error_id="837P005",
                            severity="warning",
                            segment_id="HI",
                            element_index=1,
                            line_number=seg.line_number,
                            message=f"HI qualifier '{qualifier}' may not be a standard diagnosis qualifier",
                            suggestion="Use ABK (ICD-10 Principal) or ABF (ICD-10 Other)",
                        ))

    if not has_clm:
        errors.append(ValidationError(
            error_id="837P010",
            severity="error",
            segment_id="CLM",
            message="No CLM (Claim) segment found — at least one claim is required",
            suggestion="Add a CLM segment with claim details",
        ))

    if not has_billing_provider:
        errors.append(ValidationError(
            error_id="837P011",
            severity="error",
            segment_id="NM1",
            loop_location="2010AA",
            message="No Billing Provider (NM1*85) segment found",
            suggestion="Add NM1 segment with qualifier 85 for the billing provider",
        ))

    if not has_subscriber:
        errors.append(ValidationError(
            error_id="837P012",
            severity="error",
            segment_id="NM1",
            loop_location="2010BA",
            message="No Subscriber (NM1*IL) segment found",
            suggestion="Add NM1 segment with qualifier IL for the subscriber",
        ))


def validate_835(segments: list[Segment], errors: list[ValidationError]):
    """835-specific validation rules."""
    has_clp = False
    has_payer = False
    has_payee = False

    for seg in segments:
        if seg.segment_id == "CLP":
            has_clp = True
            # CLP02 (claim status) check
            if len(seg.elements) >= 2:
                valid_status = {"1", "2", "3", "4", "19", "20", "21", "22", "23", "25"}
                status = seg.elements[1].value.strip()
                if status not in valid_status:
                    errors.append(ValidationError(
                        error_id="835001",
                        severity="warning",
                        segment_id="CLP",
                        element_index=2,
                        line_number=seg.line_number,
                        message=f"CLP02 (Claim Status) '{status}' is non-standard",
                        suggestion=f"Use one of: {', '.join(sorted(valid_status))}",
                    ))
            # CLP03 (total charge) must be numeric
            if len(seg.elements) >= 3:
                try:
                    float(seg.elements[2].value)
                except ValueError:
                    errors.append(ValidationError(
                        error_id="835002",
                        severity="error",
                        segment_id="CLP",
                        element_index=3,
                        line_number=seg.line_number,
                        message=f"CLP03 (Total Charge) '{seg.elements[2].value}' is not valid",
                        suggestion="Enter a valid numeric amount",
                        fixable=True,
                        fix_value="0.00",
                    ))

        elif seg.segment_id == "N1":
            if len(seg.elements) >= 1:
                if seg.elements[0].value.strip() == "PR":
                    has_payer = True
                elif seg.elements[0].value.strip() == "PE":
                    has_payee = True

        elif seg.segment_id == "CAS":
            # Adjustment segments
            if len(seg.elements) >= 3:
                group_code = seg.elements[0].value.strip()
                if group_code not in ("CO", "OA", "PI", "PR", "CR"):
                    errors.append(ValidationError(
                        error_id="835003",
                        severity="warning",
                        segment_id="CAS",
                        element_index=1,
                        line_number=seg.line_number,
                        message=f"CAS01 (Adjustment Group Code) '{group_code}' is non-standard",
                        suggestion="Use CO (Contractual Obligation), OA, PI, PR (Patient Responsibility), or CR",
                    ))

    if not has_clp:
        errors.append(ValidationError(
            error_id="835010",
            severity="error",
            segment_id="CLP",
            message="No CLP (Claim Payment) segment found",
            suggestion="Add at least one CLP segment",
        ))

    if not has_payer:
        errors.append(ValidationError(
            error_id="835011",
            severity="error",
            segment_id="N1",
            loop_location="1000A",
            message="No Payer (N1*PR) segment found",
            suggestion="Add N1 segment with qualifier PR for payer identification",
        ))


def validate_834(segments: list[Segment], errors: list[ValidationError]):
    """834-specific validation rules."""
    has_ins = False
    has_sponsor = False
    has_payer = False

    for seg in segments:
        if seg.segment_id == "INS":
            has_ins = True
            # INS01 (Yes/No) must be Y or N
            if len(seg.elements) >= 1:
                ins01 = seg.elements[0].value.strip()
                if ins01 not in ("Y", "N"):
                    errors.append(ValidationError(
                        error_id="834001",
                        severity="error",
                        segment_id="INS",
                        element_index=1,
                        line_number=seg.line_number,
                        message=f"INS01 (Subscriber Indicator) '{ins01}' must be Y or N",
                        suggestion="Set to Y (subscriber) or N (dependent)",
                        fixable=True,
                        fix_value="Y",
                    ))
            # INS03 (Maintenance Type Code)
            if len(seg.elements) >= 3:
                valid_maint = {"001", "002", "021", "024", "025", "026", "030", "032"}
                maint = seg.elements[2].value.strip()
                if maint and maint not in valid_maint:
                    errors.append(ValidationError(
                        error_id="834002",
                        severity="warning",
                        segment_id="INS",
                        element_index=3,
                        line_number=seg.line_number,
                        message=f"INS03 (Maintenance Type Code) '{maint}' is non-standard",
                        suggestion=f"Common codes: 001 (Change), 021 (Addition), 024 (Cancellation/Termination)",
                    ))

        elif seg.segment_id == "N1":
            if len(seg.elements) >= 1:
                if seg.elements[0].value.strip() == "P5":
                    has_sponsor = True
                elif seg.elements[0].value.strip() == "IN":
                    has_payer = True

        elif seg.segment_id == "DMG":
            # Demographics - validate date of birth
            if len(seg.elements) >= 2:
                dob = seg.elements[1].value.strip()
                if dob and not validate_date(dob):
                    errors.append(ValidationError(
                        error_id="834003",
                        severity="error",
                        segment_id="DMG",
                        element_index=2,
                        line_number=seg.line_number,
                        message=f"DMG02 (Date of Birth) '{dob}' is not a valid date (CCYYMMDD)",
                        suggestion="Enter date in CCYYMMDD format (e.g., 19900115)",
                        fixable=False,
                    ))
            # Gender code
            if len(seg.elements) >= 3:
                gender = seg.elements[2].value.strip()
                if gender and gender not in ("M", "F", "U"):
                    errors.append(ValidationError(
                        error_id="834004",
                        severity="warning",
                        segment_id="DMG",
                        element_index=3,
                        line_number=seg.line_number,
                        message=f"DMG03 (Gender Code) '{gender}' should be M, F, or U",
                        suggestion="Use M (Male), F (Female), or U (Unknown)",
                        fixable=True,
                        fix_value="U",
                    ))

        elif seg.segment_id == "N4":
            # City/State/ZIP
            if len(seg.elements) >= 2:
                state = seg.elements[1].value.strip()
                if state and not validate_state(state):
                    errors.append(ValidationError(
                        error_id="834005",
                        severity="warning",
                        segment_id="N4",
                        element_index=2,
                        line_number=seg.line_number,
                        message=f"N402 (State) '{state}' is not a valid US state code",
                        suggestion="Use a valid 2-letter US state code",
                    ))
            if len(seg.elements) >= 3:
                zip_code = seg.elements[2].value.strip()
                if zip_code and not validate_zip(zip_code):
                    errors.append(ValidationError(
                        error_id="834006",
                        severity="warning",
                        segment_id="N4",
                        element_index=3,
                        line_number=seg.line_number,
                        message=f"N403 (ZIP) '{zip_code}' is not a valid US ZIP code",
                        suggestion="Use 5-digit or 9-digit ZIP code",
                    ))

    if not has_ins:
        errors.append(ValidationError(
            error_id="834010",
            severity="error",
            segment_id="INS",
            message="No INS (Member Information) segment found",
            suggestion="Add at least one INS segment for member enrollment data",
        ))

    if not has_sponsor:
        errors.append(ValidationError(
            error_id="834011",
            severity="warning",
            segment_id="N1",
            loop_location="1000A",
            message="No Sponsor (N1*P5) segment found",
            suggestion="Add N1 segment with qualifier P5 for sponsor identification",
        ))


def validate_common(segments: list[Segment], errors: list[ValidationError]):
    """Common validation rules applicable to all transaction types."""
    for seg in segments:
        # Validate NM1 segments (common across types)
        if seg.segment_id == "NM1":
            # NM108 (ID Code Qualifier) + NM109 (ID Code)
            if len(seg.elements) >= 9:
                qualifier = seg.elements[7].value.strip()
                id_code = seg.elements[8].value.strip()
                if qualifier == "XX" and id_code:
                    # XX = NPI, validate with Luhn
                    if not luhn_check(id_code):
                        errors.append(ValidationError(
                            error_id="COM001",
                            severity="error",
                            segment_id="NM1",
                            element_index=9,
                            line_number=seg.line_number,
                            message=f"NPI '{id_code}' fails Luhn check validation",
                            suggestion="Verify the NPI number at https://npiregistry.cms.hhs.gov/",
                            fixable=False,
                        ))

        # DTP date validation
        elif seg.segment_id == "DTP":
            if len(seg.elements) >= 3:
                date_format = seg.elements[1].value.strip()
                date_value = seg.elements[2].value.strip()
                if date_format == "D8" and date_value:
                    if not validate_date(date_value):
                        errors.append(ValidationError(
                            error_id="COM002",
                            severity="error",
                            segment_id="DTP",
                            element_index=3,
                            line_number=seg.line_number,
                            message=f"DTP03 date '{date_value}' is not a valid CCYYMMDD date",
                            suggestion="Enter date in CCYYMMDD format (e.g., 20240115)",
                            fixable=False,
                        ))

        # N4 ZIP validation
        elif seg.segment_id == "N4":
            if len(seg.elements) >= 3:
                zip_code = seg.elements[2].value.strip()
                if zip_code and not validate_zip(zip_code):
                    errors.append(ValidationError(
                        error_id="COM003",
                        severity="warning",
                        segment_id="N4",
                        element_index=3,
                        line_number=seg.line_number,
                        message=f"N403 ZIP code '{zip_code}' format is invalid",
                        suggestion="Use 5-digit or 9-digit US ZIP code",
                    ))


def validate_edi(parse_result: ParseResult) -> ValidationResult:
    """
    Main validation entry point: run all applicable rules.
    """
    errors: list[ValidationError] = []

    if not parse_result.segments:
        errors.append(ValidationError(
            error_id="GEN001",
            severity="error",
            message="No segments found in the file",
        ))
        return ValidationResult(
            is_valid=False,
            error_count=1,
            errors=errors,
        )

    # Envelope validation (all types)
    validate_envelope(parse_result.segments, errors)

    # Common validations
    validate_common(parse_result.segments, errors)

    # Type-specific validation
    tx = parse_result.transaction_type
    if tx == "837P" or tx == "837I":
        validate_837p(parse_result.segments, errors)
    elif tx == "835":
        validate_835(parse_result.segments, errors)
    elif tx == "834":
        validate_834(parse_result.segments, errors)

    # Compute counts
    error_count = sum(1 for e in errors if e.severity == "error")
    warning_count = sum(1 for e in errors if e.severity == "warning")
    info_count = sum(1 for e in errors if e.severity == "info")

    return ValidationResult(
        is_valid=error_count == 0,
        error_count=error_count,
        warning_count=warning_count,
        info_count=info_count,
        errors=errors,
    )
