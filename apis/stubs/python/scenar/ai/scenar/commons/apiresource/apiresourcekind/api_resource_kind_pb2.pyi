from ai.scenar.commons.apiresource.apiresourcekind import api_resource_group_pb2 as _api_resource_group_pb2
from google.protobuf import descriptor_pb2 as _descriptor_pb2
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ApiResourceVersion(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    api_resource_version_unspecified: _ClassVar[ApiResourceVersion]
    v1: _ClassVar[ApiResourceVersion]

class ApiResourceKind(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    api_resource_kind_unknown: _ClassVar[ApiResourceKind]
    scenario: _ClassVar[ApiResourceKind]
    organization: _ClassVar[ApiResourceKind]
    api_key: _ClassVar[ApiResourceKind]
api_resource_version_unspecified: ApiResourceVersion
v1: ApiResourceVersion
api_resource_kind_unknown: ApiResourceKind
scenario: ApiResourceKind
organization: ApiResourceKind
api_key: ApiResourceKind
KIND_META_FIELD_NUMBER: _ClassVar[int]
kind_meta: _descriptor.FieldDescriptor

class ApiResourceKindMeta(_message.Message):
    __slots__ = ("group", "version", "name", "display_name", "id_prefix", "is_versioned")
    GROUP_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    DISPLAY_NAME_FIELD_NUMBER: _ClassVar[int]
    ID_PREFIX_FIELD_NUMBER: _ClassVar[int]
    IS_VERSIONED_FIELD_NUMBER: _ClassVar[int]
    group: _api_resource_group_pb2.ApiResourceGroup
    version: ApiResourceVersion
    name: str
    display_name: str
    id_prefix: str
    is_versioned: bool
    def __init__(self, group: _Optional[_Union[_api_resource_group_pb2.ApiResourceGroup, str]] = ..., version: _Optional[_Union[ApiResourceVersion, str]] = ..., name: _Optional[str] = ..., display_name: _Optional[str] = ..., id_prefix: _Optional[str] = ..., is_versioned: bool = ...) -> None: ...
