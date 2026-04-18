from ai.scenar.scenario.v1 import enum_pb2 as _enum_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf import struct_pb2 as _struct_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Scenario(_message.Message):
    __slots__ = ("viewport", "steps")
    VIEWPORT_FIELD_NUMBER: _ClassVar[int]
    STEPS_FIELD_NUMBER: _ClassVar[int]
    viewport: ViewportConfig
    steps: _containers.RepeatedCompositeFieldContainer[Step]
    def __init__(self, viewport: _Optional[_Union[ViewportConfig, _Mapping]] = ..., steps: _Optional[_Iterable[_Union[Step, _Mapping]]] = ...) -> None: ...

class ViewportConfig(_message.Message):
    __slots__ = ("width", "height")
    WIDTH_FIELD_NUMBER: _ClassVar[int]
    HEIGHT_FIELD_NUMBER: _ClassVar[int]
    width: int
    height: int
    def __init__(self, width: _Optional[int] = ..., height: _Optional[int] = ...) -> None: ...

class Step(_message.Message):
    __slots__ = ("view", "delay_ms", "caption", "narration_text", "props", "interactions")
    VIEW_FIELD_NUMBER: _ClassVar[int]
    DELAY_MS_FIELD_NUMBER: _ClassVar[int]
    CAPTION_FIELD_NUMBER: _ClassVar[int]
    NARRATION_TEXT_FIELD_NUMBER: _ClassVar[int]
    PROPS_FIELD_NUMBER: _ClassVar[int]
    INTERACTIONS_FIELD_NUMBER: _ClassVar[int]
    view: str
    delay_ms: int
    caption: str
    narration_text: str
    props: _struct_pb2.Struct
    interactions: _containers.RepeatedCompositeFieldContainer[StepAction]
    def __init__(self, view: _Optional[str] = ..., delay_ms: _Optional[int] = ..., caption: _Optional[str] = ..., narration_text: _Optional[str] = ..., props: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ..., interactions: _Optional[_Iterable[_Union[StepAction, _Mapping]]] = ...) -> None: ...

class StepAction(_message.Message):
    __slots__ = ("at_percent", "type", "target", "click_config", "type_config", "hover_config", "drag_config", "scroll_to_config", "viewport_transition_config")
    AT_PERCENT_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    TARGET_FIELD_NUMBER: _ClassVar[int]
    CLICK_CONFIG_FIELD_NUMBER: _ClassVar[int]
    TYPE_CONFIG_FIELD_NUMBER: _ClassVar[int]
    HOVER_CONFIG_FIELD_NUMBER: _ClassVar[int]
    DRAG_CONFIG_FIELD_NUMBER: _ClassVar[int]
    SCROLL_TO_CONFIG_FIELD_NUMBER: _ClassVar[int]
    VIEWPORT_TRANSITION_CONFIG_FIELD_NUMBER: _ClassVar[int]
    at_percent: float
    type: _enum_pb2.ActionType
    target: str
    click_config: ClickConfig
    type_config: TypeConfig
    hover_config: HoverConfig
    drag_config: DragConfig
    scroll_to_config: ScrollToConfig
    viewport_transition_config: ViewportTransitionConfig
    def __init__(self, at_percent: _Optional[float] = ..., type: _Optional[_Union[_enum_pb2.ActionType, str]] = ..., target: _Optional[str] = ..., click_config: _Optional[_Union[ClickConfig, _Mapping]] = ..., type_config: _Optional[_Union[TypeConfig, _Mapping]] = ..., hover_config: _Optional[_Union[HoverConfig, _Mapping]] = ..., drag_config: _Optional[_Union[DragConfig, _Mapping]] = ..., scroll_to_config: _Optional[_Union[ScrollToConfig, _Mapping]] = ..., viewport_transition_config: _Optional[_Union[ViewportTransitionConfig, _Mapping]] = ...) -> None: ...

class ClickConfig(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class TypeConfig(_message.Message):
    __slots__ = ("text", "type_delay_ms")
    TEXT_FIELD_NUMBER: _ClassVar[int]
    TYPE_DELAY_MS_FIELD_NUMBER: _ClassVar[int]
    text: str
    type_delay_ms: int
    def __init__(self, text: _Optional[str] = ..., type_delay_ms: _Optional[int] = ...) -> None: ...

class HoverConfig(_message.Message):
    __slots__ = ("hover_duration_ms",)
    HOVER_DURATION_MS_FIELD_NUMBER: _ClassVar[int]
    hover_duration_ms: int
    def __init__(self, hover_duration_ms: _Optional[int] = ...) -> None: ...

class DragConfig(_message.Message):
    __slots__ = ("drag_target",)
    DRAG_TARGET_FIELD_NUMBER: _ClassVar[int]
    drag_target: str
    def __init__(self, drag_target: _Optional[str] = ...) -> None: ...

class ScrollToConfig(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ViewportTransitionConfig(_message.Message):
    __slots__ = ("viewport_zoom", "viewport_reset")
    VIEWPORT_ZOOM_FIELD_NUMBER: _ClassVar[int]
    VIEWPORT_RESET_FIELD_NUMBER: _ClassVar[int]
    viewport_zoom: float
    viewport_reset: bool
    def __init__(self, viewport_zoom: _Optional[float] = ..., viewport_reset: bool = ...) -> None: ...
