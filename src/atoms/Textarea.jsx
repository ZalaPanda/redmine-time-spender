import React, { useEffect, useRef } from 'react';

export const Textarea = (props) => {
    const element = useRef();
    useEffect(() => {
        element.current.style.height = '0px'; // reset height
        element.current.style.height = element.current.scrollHeight && `${element.current.scrollHeight}px` || ''; // set scroll height
    }, [props.value]);
    return <textarea ref={element} {...props} />
};
