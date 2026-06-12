from ai.scenar.commons.apiresource import metadata_pb2 as _metadata_pb2
from ai.scenar.deploy.v1 import spec_pb2 as _spec_pb2
from ai.scenar.deploy.v1 import status_pb2 as _status_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Deploy(_message.Message):
    __slots__ = ("api_version", "kind", "metadata", "spec", "status")
    API_VERSION_FIELD_NUMBER: _ClassVar[int]
    KIND_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    SPEC_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    api_version: str
    kind: str
    metadata: _metadata_pb2.ApiResourceMetadata
    spec: _spec_pb2.DeploySpec
    status: _status_pb2.DeployStatus
    def __init__(self, api_version: _Optional[str] = ..., kind: _Optional[str] = ..., metadata: _Optional[_Union[_metadata_pb2.ApiResourceMetadata, _Mapping]] = ..., spec: _Optional[_Union[_spec_pb2.DeploySpec, _Mapping]] = ..., status: _Optional[_Union[_status_pb2.DeployStatus, _Mapping]] = ...) -> None: ...

class DeployList(_message.Message):
    __slots__ = ("api_version", "kind", "items", "next_page_token")
    API_VERSION_FIELD_NUMBER: _ClassVar[int]
    KIND_FIELD_NUMBER: _ClassVar[int]
    ITEMS_FIELD_NUMBER: _ClassVar[int]
    NEXT_PAGE_TOKEN_FIELD_NUMBER: _ClassVar[int]
    api_version: str
    kind: str
    items: _containers.RepeatedCompositeFieldContainer[Deploy]
    next_page_token: str
    def __init__(self, api_version: _Optional[str] = ..., kind: _Optional[str] = ..., items: _Optional[_Iterable[_Union[Deploy, _Mapping]]] = ..., next_page_token: _Optional[str] = ...) -> None: ...
