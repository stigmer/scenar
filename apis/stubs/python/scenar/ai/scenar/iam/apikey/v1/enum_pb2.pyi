from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from typing import ClassVar as _ClassVar

DESCRIPTOR: _descriptor.FileDescriptor

class ApiKeyScope(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    api_key_scope_unspecified: _ClassVar[ApiKeyScope]
    deploy_create: _ClassVar[ApiKeyScope]
    deploy_upload: _ClassVar[ApiKeyScope]
api_key_scope_unspecified: ApiKeyScope
deploy_create: ApiKeyScope
deploy_upload: ApiKeyScope
