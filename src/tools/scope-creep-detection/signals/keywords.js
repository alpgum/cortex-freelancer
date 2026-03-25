// Deterministic keyword lists used across signal extractors.

const CHANGE_REQUEST_PATTERNS = [
  /can you (also|add|include)/i,
  /could you (also|add|include)/i,
  /we should (also|add|include)/i,
  /add(ing)? (a|another|new)/i,
  /include (a|another|new)/i,
  /new (feature|page|section|report|dashboard|endpoint)/i,
  /change request/i,
  /scope (change|creep|increase|expand|expanding)/i,
  /out of scope/i,
  /one more thing/i,
  /quick (change|tweak|update)/i,
  /small (change|tweak|update)/i,
  /additional (work|feature|request)/i,
  /extra (work|feature|request|meeting)/i,
  /revision/i,
  /revisions/i,
  /tweak/i,
  /iterate/i,
];

const DELIVERABLE_PATTERNS = [
  /new (deliverable|feature|page|screen|flow|integration|report|dashboard|api|endpoint)/i,
  /add (a|another) (page|screen|feature|integration|report|dashboard|api|endpoint)/i,
  /include (a|another) (page|screen|feature|integration|report|dashboard|api|endpoint)/i,
  /also need/i,
  /in addition/i,
];

const REVISION_PATTERNS = [
  /revision/i,
  /revise/i,
  /change(s)? (again|round)/i,
  /another round/i,
  /one more round/i,
  /tweak/i,
  /polish/i,
  /fine[- ]?tune/i,
];

const MEETING_PATTERNS = [
  /meeting/i,
  /call/i,
  /sync/i,
  /stand[- ]?up/i,
  /check[- ]?in/i,
  /status (call|meeting)/i,
];

const UNPAID_PATTERNS = [
  /non[- ]?billable/i,
  /unpaid/i,
  /pro bono/i,
  /free of charge/i,
  /no charge/i,
];

const URGENCY_PATTERNS = [
  /asap/i,
  /urgent/i,
  /priority/i,
  /by (eod|end of day|tomorrow|friday|monday)/i,
  /move (the )?deadline/i,
  /bring (it )?forward/i,
  /earlier/i,
  /faster/i,
  /rush/i,
  /tight timeline/i,
];

module.exports = {
  CHANGE_REQUEST_PATTERNS,
  DELIVERABLE_PATTERNS,
  REVISION_PATTERNS,
  MEETING_PATTERNS,
  UNPAID_PATTERNS,
  URGENCY_PATTERNS,
};
