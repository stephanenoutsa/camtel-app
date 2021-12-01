from dotenv import load_dotenv
from flask import Flask
from flask_restful import abort, Api, Resource
from operator import itemgetter
import os
from PIL import Image

load_dotenv()

app = Flask(__name__)
api = Api(app)

PORT = os.getenv('FLASK_PORT')

class CaptchaNormalizer(Resource):
    def get(self):
        
        image = Image.open("image.jpg")
        image = image.convert("P")
        
        his = image.histogram()
        
        values = {}
        exceptions = []
        
        for i in range(256):
            values[i] = his[i]
        
        for j,k in sorted(values.items(), key=itemgetter(1), reverse=True)[:10]:
            print(j,k)
        
        for j,k in sorted(values.items(), key=itemgetter(1), reverse=True)[:4]:
            exceptions.append(j)
            
        processed_image = Image.new("P", image.size, 0)

        temp = {}

        for x in range(image.size[1]):
            for y in range(image.size[0]):
                pix = image.getpixel((y,x))
                temp[pix] = pix
                
                if pix in exceptions:
                    processed_image.putpixel((y,x), 255)

        processed_image.save("output.gif")
        
        return

api.add_resource(CaptchaNormalizer, '/normalize')

if __name__ == '__main__':
    app.run(debug=True, port=PORT)