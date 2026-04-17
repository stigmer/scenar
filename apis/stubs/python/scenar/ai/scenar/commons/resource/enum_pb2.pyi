from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from typing import ClassVar as _ClassVar

DESCRIPTOR: _descriptor.FileDescriptor

class ResourceVisibility(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    resource_visibility_unspecified: _ClassVar[ResourceVisibility]
    visibility_private: _ClassVar[ResourceVisibility]
    visibility_public: _ClassVar[ResourceVisibility]

class ResourceEventType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    unspecified: _ClassVar[ResourceEventType]
    created: _ClassVar[ResourceEventType]
    updated: _ClassVar[ResourceEventType]
    deleted: _ClassVar[ResourceEventType]
    renamed: _ClassVar[ResourceEventType]
resource_visibility_unspecified: ResourceVisibility
visibility_private: ResourceVisibility
visibility_public: ResourceVisibility
unspecified: ResourceEventType
created: ResourceEventType
updated: ResourceEventType
deleted: ResourceEventType
renamed: ResourceEventType
