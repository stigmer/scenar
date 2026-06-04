from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from typing import ClassVar as _ClassVar

DESCRIPTOR: _descriptor.FileDescriptor

class IamPermission(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    unspecified: _ClassVar[IamPermission]
    can_view: _ClassVar[IamPermission]
    can_edit: _ClassVar[IamPermission]
    can_delete: _ClassVar[IamPermission]
    can_grant_access: _ClassVar[IamPermission]
    can_view_access: _ClassVar[IamPermission]
    can_create_scenario: _ClassVar[IamPermission]
    can_read_secrets: _ClassVar[IamPermission]
    can_bootstrap_iam: _ClassVar[IamPermission]
    can_manage_identity_accounts: _ClassVar[IamPermission]
    login_to_back_office: _ClassVar[IamPermission]

class IamRole(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    iam_role_unspecified: _ClassVar[IamRole]
    owner: _ClassVar[IamRole]
    admin: _ClassVar[IamRole]
    member: _ClassVar[IamRole]
    viewer: _ClassVar[IamRole]
unspecified: IamPermission
can_view: IamPermission
can_edit: IamPermission
can_delete: IamPermission
can_grant_access: IamPermission
can_view_access: IamPermission
can_create_scenario: IamPermission
can_read_secrets: IamPermission
can_bootstrap_iam: IamPermission
can_manage_identity_accounts: IamPermission
login_to_back_office: IamPermission
iam_role_unspecified: IamRole
owner: IamRole
admin: IamRole
member: IamRole
viewer: IamRole
