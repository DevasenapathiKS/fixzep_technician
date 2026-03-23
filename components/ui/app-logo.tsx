import React from 'react';
import { Image, ImageProps, StyleProp, ImageStyle } from 'react-native';

type AppLogoProps = Omit<ImageProps, 'source'> & {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

const AppLogo = ({ size = 32, style, ...rest }: AppLogoProps) => {
  return (
    <Image
      // Image must live under the Expo app root; this icon already comes from your logo set.
      source={require('../../assets/images/icon.png')}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 5,
        },
        style,
      ]}
      resizeMode="contain"
      {...rest}
    />
  );
};

export default AppLogo;
export { AppLogo };
