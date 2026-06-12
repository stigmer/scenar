from ai.scenar.commons.apiresource import field_options_pb2 as _field_options_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class DeploySpec(_message.Message):
    __slots__ = ("scenario_id",)
    SCENARIO_ID_FIELD_NUMBER: _ClassVar[int]
    scenario_id: str
    def __init__(self, scenario_id: _Optional[str] = ...) -> None: ...
