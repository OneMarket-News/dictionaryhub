// Package lifecycle is the state machine a governed stage must walk.
//
// The machine exists to make one class of shortcut impossible to take quietly:
// AUDIT_PASSED does not reach RELEASED. Release requires a separate, separately
// signed RELEASE_AUTHORIZED step, because a passing audit is evidence and never
// approval. No AI role, and no green verifier, occupies that step.
//
// RELEASED is terminal. Modifying a released stage requires a NEW signed
// authorization; a consumed authorization never authorizes a descendant.
package lifecycle

import "fmt"

// State is one lifecycle position.
type State string

const (
	Defined                State = "DEFINED"
	Active                 State = "ACTIVE"
	ImplementationComplete State = "IMPLEMENTATION_COMPLETE"
	AuditPending           State = "AUDIT_PENDING"
	AuditFailed            State = "AUDIT_FAILED"
	RepairActive           State = "REPAIR_ACTIVE"
	AuditPassed            State = "AUDIT_PASSED"
	ReleaseAuthorized      State = "RELEASE_AUTHORIZED"
	Released               State = "RELEASED"
)

// AuthorizationIssueState is the only state a StageAuthorization may be issued
// in. Anything else is a lifecycle object masquerading as an authorization.
const AuthorizationIssueState = Defined

var states = []State{
	Defined, Active, ImplementationComplete, AuditPending,
	AuditFailed, RepairActive, AuditPassed, ReleaseAuthorized, Released,
}

// transitions is the complete edge set. A state absent from a value list cannot
// be reached from that key, and there is no wildcard.
var transitions = map[State][]State{
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

// States returns every known state in lifecycle order.
func States() []State {
	out := make([]State, len(states))
	copy(out, states)
	return out
}

// Known reports whether s is a declared state.
func Known(s State) bool {
	_, ok := transitions[s]
	return ok
}

// Next returns the states reachable in one step from s.
func Next(s State) []State {
	out := make([]State, len(transitions[s]))
	copy(out, transitions[s])
	return out
}

// Terminal reports whether no transition leaves s.
func Terminal(s State) bool { return Known(s) && len(transitions[s]) == 0 }

// Allowed reports whether from -> to is a declared transition. A self
// transition is not one: staying put is not an event, and recording it as one
// would let a stage claim progress it did not make.
func Allowed(from, to State) bool {
	if !Known(from) || !Known(to) {
		return false
	}
	for _, candidate := range transitions[from] {
		if candidate == to {
			return true
		}
	}
	return false
}

// Transition validates from -> to and explains any refusal.
func Transition(from, to State) error {
	if !Known(from) {
		return fmt.Errorf("unknown lifecycle state %q", from)
	}
	if !Known(to) {
		return fmt.Errorf("unknown lifecycle state %q", to)
	}
	if Terminal(from) {
		return fmt.Errorf("%s is terminal; a released stage requires a new signed authorization", from)
	}
	if !Allowed(from, to) {
		return fmt.Errorf("%s does not transition to %s", from, to)
	}
	return nil
}
