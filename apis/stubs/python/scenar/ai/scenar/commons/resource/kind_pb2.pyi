from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from typing import ClassVar as _ClassVar

DESCRIPTOR: _descriptor.FileDescriptor

class ResourceKind(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    resource_kind_unspecified: _ClassVar[ResourceKind]
    scenario: _ClassVar[ResourceKind]
resource_kind_unspecified: ResourceKind
scenario: ResourceKind
