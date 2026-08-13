package lifecycle

import "testing"

// The rule the whole machine exists to enforce: a passing audit is evidence,
// never approval. AUDIT_PASSED must not reach RELEASED without a separate,
// separately signed release authorization.
func TestAuditPassedCannotReachReleasedDirectly(t *testing.T) {
	if Allowed(AuditPassed, Released) {
		t.Fatal("AUDIT_PASSED transitions directly to RELEASED; release would need no separate authorization")
	}
	if err := Transition(AuditPassed, Released); err == nil {
		t.Fatal("Transition permitted AUDIT_PASSED -> RELEASED")
	}
	if !Allowed(AuditPassed, ReleaseAuthorized) || !Allowed(ReleaseAuthorized, Released) {
		t.Error("the two-step release path is not available")
	}
}

func TestReleasedIsTerminal(t *testing.T) {
	if !Terminal(Released) {
		t.Fatal("RELEASED is not terminal")
	}
	for _, to := range States() {
		if Allowed(Released, to) {
			t.Errorf("RELEASED transitions to %s; a released stage must require a new signed authorization", to)
		}
	}
	if err := Transition(Released, Active); err == nil {
		t.Error("Transition left the terminal state")
	}
	for _, s := range States() {
		if s != Released && Terminal(s) {
			t.Errorf("%s is terminal but is not RELEASED", s)
		}
	}
}

// The complete edge set, written out independently of the implementation's own
// table so that a change to the machine has to be made twice, deliberately.
func TestCompleteTransitionTable(t *testing.T) {
	expected := map[State][]State{
		Defined:                {Active},
		Active:                 {ImplementationComplete},
		ImplementationComplete: {AuditPending},
		AuditPending:           {AuditPassed, AuditFailed},
		AuditFailed:            {RepairActive},
		RepairActive:           {ImplementationComplete},
		AuditPassed:            {ReleaseAuthorized},
		ReleaseAuthorized:      {Released},
		Released:               {},
	}
	if len(States()) != len(expected) {
		t.Fatalf("the machine declares %d states, the contract names %d", len(States()), len(expected))
	}
	for from, wantTo := range expected {
		for _, to := range States() {
			want := false
			for _, candidate := range wantTo {
				if candidate == to {
					want = true
				}
			}
			if got := Allowed(from, to); got != want {
				t.Errorf("Allowed(%s, %s) = %v, want %v", from, to, got, want)
			}
		}
	}
}

func TestSelfTransitionIsNotAnEvent(t *testing.T) {
	for _, s := range States() {
		if Allowed(s, s) {
			t.Errorf("%s transitions to itself; staying put is not progress to record", s)
		}
	}
}

func TestUnknownStates(t *testing.T) {
	unknown := State("SHIPPED")
	if Known(unknown) {
		t.Error("an undeclared state is known")
	}
	if Allowed(Defined, unknown) || Allowed(unknown, Active) {
		t.Error("an undeclared state participates in transitions")
	}
	if err := Transition(unknown, Active); err == nil {
		t.Error("Transition accepted an undeclared source state")
	}
	if err := Transition(Defined, unknown); err == nil {
		t.Error("Transition accepted an undeclared target state")
	}
	if err := Transition(State(""), State("")); err == nil {
		t.Error("Transition accepted empty states")
	}
	// Case is significant: "defined" is not DEFINED.
	if Known(State("defined")) {
		t.Error("state comparison is case-insensitive")
	}
}

func TestAuthorizationIssueState(t *testing.T) {
	if AuthorizationIssueState != Defined {
		t.Errorf("a StageAuthorization may be issued in %s; anything else is a lifecycle object masquerading as an authorization", AuthorizationIssueState)
	}
}

func TestRepairLoopReturnsThroughAudit(t *testing.T) {
	// A failed audit cannot go straight back to a passing one: the only way out
	// of AUDIT_FAILED is repair, and the only way out of repair is another
	// audit.
	if Allowed(AuditFailed, AuditPassed) {
		t.Error("a failed audit reached a pass without repair")
	}
	if Allowed(RepairActive, AuditPassed) || Allowed(RepairActive, AuditPending) {
		t.Error("repair reached an audit verdict without re-declaring implementation complete")
	}
	path := []State{AuditFailed, RepairActive, ImplementationComplete, AuditPending, AuditPassed}
	for i := 1; i < len(path); i++ {
		if err := Transition(path[i-1], path[i]); err != nil {
			t.Errorf("repair path step %s -> %s: %v", path[i-1], path[i], err)
		}
	}
}

func TestNextIsACopy(t *testing.T) {
	next := Next(AuditPending)
	if len(next) != 2 {
		t.Fatalf("AUDIT_PENDING has %d successors", len(next))
	}
	next[0] = State("MUTATED")
	if Next(AuditPending)[0] == State("MUTATED") {
		t.Error("Next exposes the internal table to mutation")
	}
	states := States()
	states[0] = State("MUTATED")
	if States()[0] == State("MUTATED") {
		t.Error("States exposes the internal slice to mutation")
	}
}
