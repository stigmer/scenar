from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from typing import ClassVar as _ClassVar

DESCRIPTOR: _descriptor.FileDescriptor

class ApiResourceVisibility(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    api_resource_visibility_unspecified: _ClassVar[ApiResourceVisibility]
    visibility_private: _ClassVar[ApiResourceVisibility]
    visibility_public: _ClassVar[ApiResourceVisibility]

class ApiResourceEventType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    unspecified: _ClassVar[ApiResourceEventType]
    created: _ClassVar[ApiResourceEventType]
    updated: _ClassVar[ApiResourceEventType]
    deleted: _ClassVar[ApiResourceEventType]
    renamed: _ClassVar[ApiResourceEventType]
api_resource_visibility_unspecified: ApiResourceVisibility
visibility_private: ApiResourceVisibility
visibility_public: ApiResourceVisibility
unspecified: ApiResourceEventType
created: ApiResourceEventType
updated: ApiResourceEventType
deleted: ApiResourceEventType
renamed: ApiResourceEventType
