from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class PageInfo(_message.Message):
    __slots__ = ("num", "size")
    NUM_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    num: int
    size: int
    def __init__(self, num: _Optional[int] = ..., size: _Optional[int] = ...) -> None: ...
