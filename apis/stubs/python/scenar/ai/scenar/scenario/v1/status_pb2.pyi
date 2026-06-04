from ai.scenar.commons.apiresource import field_options_pb2 as _field_options_pb2
from ai.scenar.commons.apiresource import status_pb2 as _status_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ScenarioStatus(_message.Message):
    __slots__ = ("embed_url", "package_url", "has_narration", "audit")
    EMBED_URL_FIELD_NUMBER: _ClassVar[int]
    PACKAGE_URL_FIELD_NUMBER: _ClassVar[int]
    HAS_NARRATION_FIELD_NUMBER: _ClassVar[int]
    AUDIT_FIELD_NUMBER: _ClassVar[int]
    embed_url: str
    package_url: str
    has_narration: bool
    audit: _status_pb2.ApiResourceAudit
    def __init__(self, embed_url: _Optional[str] = ..., package_url: _Optional[str] = ..., has_narration: bool = ..., audit: _Optional[_Union[_status_pb2.ApiResourceAudit, _Mapping]] = ...) -> None: ...
