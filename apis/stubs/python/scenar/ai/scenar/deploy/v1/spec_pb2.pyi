from ai.scenar.commons.apiresource import field_options_pb2 as _field_options_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class DeploySpec(_message.Message):
    __slots__ = ("scenario_id", "files")
    SCENARIO_ID_FIELD_NUMBER: _ClassVar[int]
    FILES_FIELD_NUMBER: _ClassVar[int]
    scenario_id: str
    files: _containers.RepeatedCompositeFieldContainer[DeclaredFile]
    def __init__(self, scenario_id: _Optional[str] = ..., files: _Optional[_Iterable[_Union[DeclaredFile, _Mapping]]] = ...) -> None: ...

class DeclaredFile(_message.Message):
    __slots__ = ("relative_path", "sha256", "size_bytes", "content_type")
    RELATIVE_PATH_FIELD_NUMBER: _ClassVar[int]
    SHA256_FIELD_NUMBER: _ClassVar[int]
    SIZE_BYTES_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    relative_path: str
    sha256: str
    size_bytes: int
    content_type: str
    def __init__(self, relative_path: _Optional[str] = ..., sha256: _Optional[str] = ..., size_bytes: _Optional[int] = ..., content_type: _Optional[str] = ...) -> None: ...
