"""
X12 EDI Parser — recursive-descent parser for HIPAA 5010 transaction types.

Supports: 837P (Professional Claims), 837I (Institutional Claims),
          835 (Remittance/Payment), 834 (Enrollment/Benefit).
"""

from __future__ import annotations
from parser.edi_types import Element, Segment, Loop, ParseResult


# ── Transaction type identification ─────────────────────────────────────

TRANSACTION_TYPES = {
    ("HP", "837"): ("837P", "Professional Claim (837P)"),
    ("HC", "837"): ("837I", "Institutional Claim (837I)"),
    ("HP", "837P"): ("837P", "Professional Claim (837P)"),
    ("HC", "837I"): ("837I", "Institutional Claim (837I)"),
    ("HR", "835"):  ("835",  "Remittance Advice (835)"),
    ("HP", "835"):  ("835",  "Remittance Advice (835)"),
    ("BE", "834"):  ("834",  "Benefit Enrollment (834)"),
    ("EN", "834"):  ("834",  "Benefit Enrollment (834)"),
}

# GS08 version code to functional id fallback
FUNCTIONAL_ID_MAP = {
    "005010X222A1": ("837P", "Professional Claim (837P)"),
    "005010X223A2": ("837I", "Institutional Claim (837I)"),
    "005010X221A1": ("835",  "Remittance Advice (835)"),
    "005010X220A1": ("834",  "Benefit Enrollment (834)"),
}

# ── Loop definitions per transaction type ───────────────────────────────

LOOP_DEFS_837P = {
    "2000A": {"trigger": ("HL", 3, "20"), "name": "Billing Provider HL"},
    "2010AA": {"trigger": ("NM1", 1, "85"), "name": "Billing Provider Name"},
    "2010AB": {"trigger": ("NM1", 1, "87"), "name": "Pay-to Provider Name"},
    "2000B": {"trigger": ("HL", 3, "22"), "name": "Subscriber HL"},
    "2010BA": {"trigger": ("NM1", 1, "IL"), "name": "Subscriber Name"},
    "2010BB": {"trigger": ("NM1", 1, "PR"), "name": "Payer Name"},
    "2000C": {"trigger": ("HL", 3, "23"), "name": "Patient HL"},
    "2010CA": {"trigger": ("NM1", 1, "QC"), "name": "Patient Name"},
    "2300":  {"trigger": ("CLM",), "name": "Claim Information"},
    "2400":  {"trigger": ("LX",), "name": "Service Line"},
}

LOOP_DEFS_835 = {
    "1000A": {"trigger": ("N1", 1, "PR"), "name": "Payer Identification"},
    "1000B": {"trigger": ("N1", 1, "PE"), "name": "Payee Identification"},
    "2000":  {"trigger": ("LX",), "name": "Header Number"},
    "2100":  {"trigger": ("CLP",), "name": "Claim Payment Information"},
    "2110":  {"trigger": ("SVC",), "name": "Service Payment Information"},
}

LOOP_DEFS_834 = {
    "1000A": {"trigger": ("N1", 1, "P5"), "name": "Sponsor Name"},
    "1000B": {"trigger": ("N1", 1, "IN"), "name": "Payer Name"},
    "2000":  {"trigger": ("INS",), "name": "Member Level Detail"},
    "2100A": {"trigger": ("NM1", 1, "IL"), "name": "Member Name"},
    "2100B": {"trigger": ("NM1", 1, "70"), "name": "Incorrect Member Name"},
    "2300":  {"trigger": ("HD",), "name": "Health Coverage"},
    "2700":  {"trigger": ("LS",), "name": "Additional Reporting"},
}


# Segment descriptions for display
SEGMENT_DESCRIPTIONS = {
    "ISA": "Interchange Control Header",
    "IEA": "Interchange Control Trailer",
    "GS":  "Functional Group Header",
    "GE":  "Functional Group Trailer",
    "ST":  "Transaction Set Header",
    "SE":  "Transaction Set Trailer",
    "BHT": "Beginning of Hierarchical Transaction",
    "HL":  "Hierarchical Level",
    "NM1": "Name",
    "N3":  "Address",
    "N4":  "City/State/ZIP",
    "REF": "Reference Identification",
    "PER": "Contact Information",
    "CLM": "Claim Information",
    "DTP": "Date/Time Period",
    "AMT": "Monetary Amount",
    "SBR": "Subscriber Information",
    "PAT": "Patient Information",
    "DMG": "Demographic Information",
    "INS": "Member Information",
    "LX":  "Assigned Number",
    "SV1": "Professional Service",
    "SV2": "Institutional Service",
    "DG1": "Diagnosis",
    "HI":  "Health Care Information Codes",
    "CLP": "Claim Payment Information",
    "SVC": "Service Payment Information",
    "CAS": "Adjustment",
    "HD":  "Health Coverage",
    "LUI": "Language Use",
    "N1":  "Name",
    "QTY": "Quantity",
    "DTM": "Date/Time Reference",
    "SE":  "Transaction Set Trailer",
    "LS":  "Loop Header",
    "LE":  "Loop Trailer",
    "PLB": "Provider Level Balance",
    "TRN": "Trace Number",
}


def detect_delimiters(raw: str) -> tuple[str, str, str]:
    """
    Detect element separator, sub-element separator, and segment terminator
    from the ISA segment (fixed 106-char format).
    """
    if len(raw) < 106:
        # Fallback defaults
        return "*", ":", "~"

    # ISA segment is always exactly 106 characters
    element_sep = raw[3]          # Character after "ISA"
    sub_element_sep = raw[104]    # Position 104
    segment_term = raw[105]       # Position 105

    return element_sep, sub_element_sep, segment_term


def split_segments(raw: str, segment_terminator: str) -> list[str]:
    """Split raw EDI content into individual segment strings."""
    # Clean up whitespace around terminators
    content = raw.strip()
    segments = content.split(segment_terminator)
    # Clean each segment and remove empty ones
    return [s.strip() for s in segments if s.strip()]


def parse_segment(raw_segment: str, element_separator: str,
                  line_number: int = 0) -> Segment:
    """Parse a raw segment string into a Segment object."""
    parts = raw_segment.split(element_separator)
    segment_id = parts[0].strip()

    elements = []
    for i, value in enumerate(parts[1:], start=1):
        desc = ""
        elements.append(Element(index=i, value=value, description=desc))

    return Segment(
        segment_id=segment_id,
        elements=elements,
        raw=raw_segment,
        line_number=line_number,
    )


def identify_transaction_type(segments: list[Segment]) -> tuple[str, str]:
    """Identify the transaction type from GS and ST segments."""
    gs_functional_id = ""
    gs_version = ""
    st_id = ""

    for seg in segments:
        if seg.segment_id == "GS" and len(seg.elements) >= 1:
            gs_functional_id = seg.elements[0].value.strip()
            if len(seg.elements) >= 8:
                gs_version = seg.elements[7].value.strip()
        elif seg.segment_id == "ST" and len(seg.elements) >= 1:
            st_id = seg.elements[0].value.strip()
            break

    # Try GS functional ID + ST identifier
    key = (gs_functional_id, st_id)
    if key in TRANSACTION_TYPES:
        return TRANSACTION_TYPES[key]

    # Try GS functional ID + generic transaction code
    for k, v in TRANSACTION_TYPES.items():
        if k[0] == gs_functional_id:
            return v

    # Try version code
    if gs_version in FUNCTIONAL_ID_MAP:
        return FUNCTIONAL_ID_MAP[gs_version]

    # Fallback based on ST identifier alone
    if st_id == "837":
        return ("837P", "Professional Claim (837P)")
    elif st_id == "835":
        return ("835", "Remittance Advice (835)")
    elif st_id == "834":
        return ("834", "Benefit Enrollment (834)")

    return ("UNKNOWN", f"Unknown Transaction (ST={st_id})")


def get_loop_defs(transaction_type: str) -> dict:
    """Get loop definitions for a given transaction type."""
    if transaction_type == "837P":
        return LOOP_DEFS_837P
    elif transaction_type == "837I":
        return LOOP_DEFS_837P  # Similar structure to 837P
    elif transaction_type == "835":
        return LOOP_DEFS_835
    elif transaction_type == "834":
        return LOOP_DEFS_834
    return {}


def matches_trigger(segment: Segment, trigger: tuple) -> bool:
    """Check if a segment matches a loop trigger definition."""
    if not trigger:
        return False

    # First element of trigger is always the segment ID
    if segment.segment_id != trigger[0]:
        return False

    # If trigger has element index and value, check those too
    if len(trigger) >= 3:
        elem_index = trigger[1]
        expected_value = trigger[2]
        if len(segment.elements) >= elem_index:
            return segment.elements[elem_index - 1].value.strip() == expected_value
        return False

    # If only segment ID is specified, it matches
    return True


def build_hierarchy(segments: list[Segment], transaction_type: str) -> list[Loop]:
    """Build a hierarchical loop structure from flat segments."""
    loop_defs = get_loop_defs(transaction_type)
    loops: list[Loop] = []
    current_loop: Loop | None = None
    envelope_segments: list[Segment] = []

    # Track segments that go into envelope
    envelope_ids = {"ISA", "IEA", "GS", "GE", "ST", "SE", "BHT"}

    for segment in segments:
        # Check if this segment triggers a new loop
        triggered_loop = None
        for loop_id, loop_def in loop_defs.items():
            if matches_trigger(segment, loop_def["trigger"]):
                triggered_loop = Loop(
                    loop_id=loop_id,
                    name=loop_def["name"],
                    segments=[segment],
                )
                break

        if triggered_loop:
            # Save previous loop if exists
            if current_loop:
                loops.append(current_loop)
            current_loop = triggered_loop
        elif segment.segment_id in envelope_ids:
            envelope_segments.append(segment)
        elif current_loop:
            current_loop.segments.append(segment)
        else:
            envelope_segments.append(segment)

    # Don't forget the last loop
    if current_loop:
        loops.append(current_loop)

    # Prepend envelope as a virtual loop
    if envelope_segments:
        envelope_loop = Loop(
            loop_id="ENVELOPE",
            name="Interchange/Functional Group Envelope",
            segments=envelope_segments,
        )
        loops.insert(0, envelope_loop)

    return loops


def parse_edi(raw_content: str, file_name: str = "upload.edi") -> ParseResult:
    """
    Main entry point: parse a raw EDI string into a ParseResult.
    """
    if not raw_content or not raw_content.strip():
        return ParseResult(
            file_name=file_name,
            transaction_type="UNKNOWN",
            transaction_type_label="Empty file",
        )

    # 1. Detect delimiters
    elem_sep, sub_sep, seg_term = detect_delimiters(raw_content)

    # 2. Split into raw segments
    raw_segments = split_segments(raw_content, seg_term)

    # 3. Parse each segment
    segments: list[Segment] = []
    for i, raw_seg in enumerate(raw_segments):
        seg = parse_segment(raw_seg, elem_sep, line_number=i + 1)
        segments.append(seg)

    # 4. Identify transaction type
    tx_type, tx_label = identify_transaction_type(segments)

    # 5. Extract envelope metadata
    isa_control = ""
    sender_id = ""
    receiver_id = ""
    date = ""
    for seg in segments:
        if seg.segment_id == "ISA":
            if len(seg.elements) >= 13:
                isa_control = seg.elements[12].value.strip()
            if len(seg.elements) >= 6:
                sender_id = seg.elements[5].value.strip()
            if len(seg.elements) >= 8:
                receiver_id = seg.elements[7].value.strip()
            if len(seg.elements) >= 9:
                date = seg.elements[8].value.strip()
            break

    # 6. Build loop hierarchy
    loops = build_hierarchy(segments, tx_type)

    return ParseResult(
        transaction_type=tx_type,
        transaction_type_label=tx_label,
        file_name=file_name,
        interchange_control_number=isa_control,
        sender_id=sender_id,
        receiver_id=receiver_id,
        date=date,
        segment_count=len(segments),
        element_separator=elem_sep,
        segment_terminator=seg_term,
        sub_element_separator=sub_sep,
        loops=loops,
        raw_content=raw_content,
        segments=segments,
    )
