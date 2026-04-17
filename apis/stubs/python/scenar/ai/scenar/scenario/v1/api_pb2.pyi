from ai.scenar.commons.resource import metadata_pb2 as _metadata_pb2
from ai.scenar.commons.resource import status_pb2 as _status_pb2
from ai.scenar.scenario.v1 import spec_pb2 as _spec_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Scenario(_message.Message):
    __slots__ = ("api_version", "kind", "metadata", "spec", "status")
    API_VERSION_FIELD_NUMBER: _ClassVar[int]
    KIND_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    SPEC_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    api_version: str
    kind: str
    metadata: _metadata_pb2.ResourceMetadata
    spec: _spec_pb2.ScenarioSpec
    status: ScenarioStatus
    def __init__(self, api_version: _Optional[str] = ..., kind: _Optional[str] = ..., metadata: _Optional[_Union[_metadata_pb2.ResourceMetadata, _Mapping]] = ..., spec: _Optional[_Union[_spec_pb2.ScenarioSpec, _Mapping]] = ..., status: _Optional[_Union[ScenarioStatus, _Mapping]] = ...) -> None: ...

class ScenarioStatus(_message.Message):
    __slots__ = ("audit", "last_rendered_at", "validated")
    AUDIT_FIELD_NUMBER: _ClassVar[int]
    LAST_RENDERED_AT_FIELD_NUMBER: _ClassVar[int]
    VALIDATED_FIELD_NUMBER: _ClassVar[int]
    audit: _status_pb2.ResourceAudit
    last_rendered_at: _timestamp_pb2.Timestamp
    validated: bool
    def __init__(self, audit: _Optional[_Union[_status_pb2.ResourceAudit, _Mapping]] = ..., last_rendered_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., validated: bool = ...) -> None: ...
