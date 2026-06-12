from ai.scenar.commons.apiresource import field_options_pb2 as _field_options_pb2
from ai.scenar.commons.apiresource import status_pb2 as _status_pb2
from ai.scenar.deploy.v1 import enum_pb2 as _enum_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class DeployStatus(_message.Message):
    __slots__ = ("state", "embed_url", "object_key_prefix", "error_reason", "audit")
    STATE_FIELD_NUMBER: _ClassVar[int]
    EMBED_URL_FIELD_NUMBER: _ClassVar[int]
    OBJECT_KEY_PREFIX_FIELD_NUMBER: _ClassVar[int]
    ERROR_REASON_FIELD_NUMBER: _ClassVar[int]
    AUDIT_FIELD_NUMBER: _ClassVar[int]
    state: _enum_pb2.DeployState
    embed_url: str
    object_key_prefix: str
    error_reason: str
    audit: _status_pb2.ApiResourceAudit
    def __init__(self, state: _Optional[_Union[_enum_pb2.DeployState, str]] = ..., embed_url: _Optional[str] = ..., object_key_prefix: _Optional[str] = ..., error_reason: _Optional[str] = ..., audit: _Optional[_Union[_status_pb2.ApiResourceAudit, _Mapping]] = ...) -> None: ...
