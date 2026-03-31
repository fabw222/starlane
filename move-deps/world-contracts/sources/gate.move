/// Compatibility layer for world::gate — matches the real EVE Frontier gate API.
///
/// Key differences from the simplified v0:
/// - Gate uses typed witness extension pattern (authorize_extension / issue_jump_permit<Auth>)
/// - Authorization via OwnerCap<Gate> instead of operator address
/// - issue_jump_permit no longer returns JumpPermit — it transfers directly to character
/// - JumpPermit includes route_hash and expires_at_timestamp_ms
module world::gate;

use std::type_name::{Self, TypeName};
use world::access::{Self, OwnerCap};
use world::character::{Self, Character};

const E_GATE_NOT_AUTHORIZED: u64 = 3;
const E_EXTENSION_NOT_AUTHORIZED: u64 = 4;

public struct Gate has key {
    id: UID,
    owner_cap_id: ID,
    extension: Option<TypeName>,
}

public struct JumpPermit has key, store {
    id: UID,
    character_id: ID,
    route_hash: vector<u8>,
    expires_at_timestamp_ms: u64,
}

/// Register an extension type on the gate. Only the gate owner (OwnerCap holder) can do this.
/// Matches: world::gate::authorize_extension<Auth: drop>(gate, owner_cap)
public fun authorize_extension<Auth: drop>(gate: &mut Gate, owner_cap: &OwnerCap<Gate>) {
    let gate_id = object::id(gate);
    assert!(access::is_authorized(owner_cap, gate_id), E_GATE_NOT_AUTHORIZED);
    let new_type = type_name::with_defining_ids<Auth>();
    if (option::is_some(&gate.extension)) {
        let _ = option::swap(&mut gate.extension, new_type);
    } else {
        option::fill(&mut gate.extension, new_type);
    };
}

/// Issue a jump permit. Transfers directly to the character's address.
/// Both gates must have the same Auth extension configured.
/// Matches: world::gate::issue_jump_permit<Auth: drop>(source, dest, character, _: Auth, expires, ctx)
public fun issue_jump_permit<Auth: drop>(
    source_gate: &Gate,
    destination_gate: &Gate,
    character: &Character,
    _: Auth,
    expires_at_timestamp_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(option::is_some(&source_gate.extension), E_EXTENSION_NOT_AUTHORIZED);
    assert!(option::is_some(&destination_gate.extension), E_EXTENSION_NOT_AUTHORIZED);
    let expected = type_name::with_defining_ids<Auth>();
    assert!(*option::borrow(&source_gate.extension) == expected, E_EXTENSION_NOT_AUTHORIZED);
    assert!(*option::borrow(&destination_gate.extension) == expected, E_EXTENSION_NOT_AUTHORIZED);

    let permit = JumpPermit {
        id: object::new(ctx),
        character_id: object::id(character),
        // The compat layer only models permit existence and expiry for local smoke tests.
        // Production route hashing belongs to the real world package implementation.
        route_hash: vector::empty(),
        expires_at_timestamp_ms,
    };
    transfer::transfer(permit, character::character_address(character));
}

public fun is_extension_configured(gate: &Gate): bool {
    option::is_some(&gate.extension)
}

public fun owner_cap_id(gate: &Gate): ID {
    gate.owner_cap_id
}

/// Create a new gate and its OwnerCap.
/// In the real system, gates are created by the game server (anchor).
/// In the compat layer, this is public for testnet smoke testing.
public fun create_gate_and_cap(ctx: &mut TxContext): (Gate, OwnerCap<Gate>) {
    let mut gate = Gate {
        id: object::new(ctx),
        owner_cap_id: object::id_from_address(@0x0),
        extension: option::none(),
    };
    let gate_id = object::id(&gate);
    let owner_cap = access::create_owner_cap<Gate>(gate_id, ctx);
    gate.owner_cap_id = object::id(&owner_cap);
    (gate, owner_cap)
}

public fun share_gate(gate: Gate) {
    transfer::share_object(gate);
}

#[test_only]
public fun new_for_testing(ctx: &mut TxContext): (Gate, OwnerCap<Gate>) {
    create_gate_and_cap(ctx)
}

#[test_only]
public fun transfer_gate_for_testing(gate: Gate, recipient: address) {
    transfer::transfer(gate, recipient);
}

#[test_only]
public fun transfer_owner_cap_for_testing(cap: OwnerCap<Gate>, recipient: address) {
    transfer::transfer(cap, recipient);
}
