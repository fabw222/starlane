/// Compatibility layer for world::access — matches the real EVE Frontier access control API.
/// Provides OwnerCap<T> for capability-based authorization.
module world::access;

/// Object-level capability that proves ownership of a specific shared object.
/// In the real system, OwnerCaps are created by admin and stored inside Character objects.
public struct OwnerCap<phantom T> has key {
    id: UID,
    authorized_object_id: ID,
}

/// Returns true if the OwnerCap authorizes access to the given object_id.
public fun is_authorized<T: key>(owner_cap: &OwnerCap<T>, object_id: ID): bool {
    owner_cap.authorized_object_id == object_id
}

/// Create an OwnerCap for a given object ID.
/// In the real system this is admin-only (AdminACL + sponsored TX).
/// The compat layer keeps this package-scoped so external callers cannot forge ownership.
public(package) fun create_owner_cap<T: key>(
    authorized_object_id: ID,
    ctx: &mut TxContext,
): OwnerCap<T> {
    OwnerCap<T> {
        id: object::new(ctx),
        authorized_object_id,
    }
}

#[test_only]
public fun create_owner_cap_for_testing<T: key>(
    authorized_object_id: ID,
    ctx: &mut TxContext,
): OwnerCap<T> {
    create_owner_cap(authorized_object_id, ctx)
}
